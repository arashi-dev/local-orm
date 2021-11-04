import { Except, PartialDeep } from "type-fest";
import { EventListener } from "./utils/eventListener";
import { Driver } from "./drivers/interface";
import { calculateSize } from "./utils/calculateSize";
import { merge } from "./utils/merge";
import { Algo } from "./Algo";
import { Database } from "./Database";
import { CollectionItem, CollectionMetaData, CollectionOptions, Falsy } from "./interface";
import { Item } from "./Item";
import { Stack } from "./Stack";
import { DeepRequired } from "ts-essentials"

type EventIsMany<CT extends object> = { item: CollectionItem<CT>[], isMany: true }
type EventNotMany<CT extends object> = { item: CollectionItem<CT>, isMany: false }
type EventCollection<CT extends object> = { collection: Collection<CT> }
type EventContexts<CT extends object> = EventCollection<CT> & (EventNotMany<CT> | EventIsMany<CT>)

type CUDEvent<CT extends object> = (contexts: EventContexts<CT>) => void;

type Events<CT extends object> = {
    update: CUDEvent<CT>;
    delete: CUDEvent<CT>;
    insert: CUDEvent<CT>;

    drop: (contexts: EventCollection<CT>) => void;
    expire: (contexts: EventCollection<CT> & { items: CollectionItem<CT>[] }) => void
}

export class Collection<CT extends object> {
    private static collections: { [key: `${Database['name']}:${Collection<object>['name']}`]: Collection<object> } = {};
    private algo = new Algo<CT>()
    public fullName: `${Collection<object>["db"]['name']}:${this['name']}` = `${this.db.name}:${this.name}`
    private metadata: CollectionMetaData
    public options: DeepRequired<CollectionOptions<CT>>
    private expirationInterval?: NodeJS.Timer;
    private _events = new EventListener<Events<CT>>()

    public static open<CT extends object>(name: string, driver: Driver, db: Database, options?: CollectionOptions<CT>) {
        const dbFullName = db.options.group ? `${db.options.group}:${db.name}` : db.name
        const fullName = options && options.group ? `${options.group}:${name}` : name
        return (Collection.collections[`${dbFullName}:${fullName}`] ||= new Collection<CT>(name, driver, db, options) as unknown as Collection<object>) as unknown as Collection<CT>
    }

    public get siblings() {
        const collections: Collection<object>[] = []
        for (const name in Collection.collections) {
            const collection = Collection.collections[name as keyof typeof Collection.collections]

            if (name.split(":").slice(0, 1).includes(this.db.name)) {
                collections.push(collection)
            }
        }

        return collections
    }

    constructor(public name: string, private driver: Driver, private db: Database, options?: CollectionOptions<CT>) {
        const defaultOptions: DeepRequired<CollectionOptions<CT>> = {
            removeAfterLimit: true,
            maxSize: false,
            maxLength: false,
            group: null,
            expiration: {
                every: 600,
                key: null,
                handler: ({ item, key }) => {
                    const expireProp = item[key]
                    if (expireProp) {
                        const now = new Date().getSeconds()
                        const expireAt = ((typeof expireProp === "string" || typeof expireProp === "number") && new Date(expireProp)?.getSeconds()) || false
                        if (expireAt !== false && expireAt <= now) {
                            return true
                        }
                    }
                    return false
                }
            },
            refs: {}
        }
        this.options = options ? merge(defaultOptions, options) : defaultOptions

        this.metadata = {
            name,
            last: 0,
            length: 0,
            size: 0,
            fullSize: 0,
        }

        this.updateSettings(prev => ({
            ...this.metadata,
            ...prev
        }))

        if (this.options.expiration.key) {
            this.startExpiration()
        }
    }

    findMany(target?: ((item: CollectionItem<CT>) => boolean) | PartialDeep<CollectionItem<CT>>): Stack<CT> {
        const collectedItems = this.driver.get<CollectionItem<CT>[]>(this.fullName, [])
        const results = this.algo.findMany(collectedItems, target)

        return new Stack(results, this, this.db)
    }

    findOne(target?: ((item: CollectionItem<CT>) => boolean) | PartialDeep<CollectionItem<CT>>): Item<CT> | undefined {
        const collectedItems = this.driver.get<CollectionItem<CT>[]>(this.fullName, [])
        const result = this.algo.findOne(collectedItems, target)

        return result ? Item.get(result, this, this.db) : undefined
    }

    insertMany(target: Except<CollectionItem<CT>, "_id">[]): Stack<CT> {
        const { last, length, size } = this.getSettings()
        const { maxSize, maxLength, removeAfterLimit } = this.options

        if (maxLength && length + target.length > maxLength) {
            if (!removeAfterLimit) {
                target.splice(maxLength - length, target.length)
            }
        }

        const items = target.map((data, i) => ({
            ...data,
            _id: last + i + 1
        })) as CollectionItem<CT>[]

        let added = items.length;

        const prev = this.driver.get<CollectionItem<CT>[]>(this.fullName, [])
        let newItems = this.algo.insertMany(prev, items)

        if (maxLength && newItems.length > maxLength) {
            newItems.splice(0, newItems.length - maxLength)
        }

        if (maxSize) {
            const newItemsSize = calculateSize(this.driver.encode(newItems))
            if (newItemsSize > maxSize) {
                if (removeAfterLimit) {
                    while (calculateSize(this.driver.encode(newItems)) > maxSize) {
                        newItems.shift()
                    }
                } else {
                    if (maxSize === size) {
                        added = 0
                        newItems = prev
                    } else {
                        while (calculateSize(this.driver.encode(newItems)) > maxSize) {
                            added--
                            newItems.pop()
                        }
                    }
                }
            }
        }
        const savedData = this.driver.set<CollectionItem<CT>[]>(this.fullName, newItems)

        this.updateSettings((prev) => ({
            ...prev,
            last: prev.last + (added > 0 ? added : 0),
            size: calculateSize(savedData),
            fullSize: calculateSize(savedData + this.driver.encode(prev)),
            length: newItems.length,
        }))

        this._events.emit("insert", [{ collection: this, isMany: true, item: items }])

        return new Stack(items, this, this.db)
    }

    insertOne(target: Except<CollectionItem<CT>, "_id">): Item<CT> | undefined {
        const { last, length } = this.getSettings()
        const { maxSize, maxLength, removeAfterLimit } = this.options

        if (maxLength && length + 1 > maxLength) {
            if (!removeAfterLimit) {
                return undefined
            }
        }

        const item = {
            ...target,
            _id: last + 1
        } as CollectionItem<CT>

        let added = true;

        const prev = this.driver.get<CollectionItem<CT>[]>(this.fullName, [])

        let newItems = this.algo.insertOne(prev, item)

        if (maxLength && newItems.length > maxLength) {
            newItems.shift()
        }

        if (maxSize) {
            const newItemsSize = calculateSize(this.driver.encode(newItems))
            if (newItemsSize > maxSize) {
                if (removeAfterLimit) {
                    while (calculateSize(this.driver.encode(newItems)) > maxSize) {
                        newItems.shift()
                    }
                } else {
                    return undefined
                }
            }
        }

        const savedData = this.driver.set<CollectionItem<CT>[]>(this.fullName, newItems)

        this.updateSettings((prev) => ({
            ...prev,
            last: prev.last + (added ? 1 : 0),
            size: calculateSize(savedData),
            fullSize: calculateSize(savedData + this.driver.encode(prev)),
            length: newItems.length,
        }))

        this._events.emit("insert", [{ collection: this, isMany: false, item: item }])

        return Item.get(item, this, this.db)
    }

    deleteMany(target?: ((item: CollectionItem<CT>) => boolean) | PartialDeep<CollectionItem<CT>>): Stack<CT> | undefined {
        const collectedItems = this.driver.get<CollectionItem<CT>[]>(this.fullName, [])
        const { deleted, newData } = this.algo.deleteMany(collectedItems, target)
        if (!deleted.length) return undefined

        const savedData = this.driver.set<CollectionItem<CT>[]>(this.fullName, newData)

        this.updateSettings((prev) => ({
            ...prev,
            size: calculateSize(savedData),
            fullSize: calculateSize(savedData + this.driver.encode(prev)),
            length: newData.length,
        }))

        this._events.emit("delete", [{ collection: this, isMany: true, item: deleted }])

        return new Stack(deleted, this, this.db)
    }

    deleteOne(target?: ((item: CollectionItem<CT>) => boolean) | PartialDeep<CollectionItem<CT>>): Item<CT> | undefined {
        const collectedItems = this.driver.get<CollectionItem<CT>[]>(this.fullName, [])
        const { deleted, newData } = this.algo.deleteOne(collectedItems, target)
        const savedData = this.driver.set<CollectionItem<CT>[]>(this.fullName, newData)

        this.updateSettings((prev) => ({
            ...prev,
            size: calculateSize(savedData),
            fullSize: calculateSize(savedData + this.driver.encode(prev)),
            length: newData.length,
        }))

        if (deleted) {
            this._events.emit("delete", [{ collection: this, isMany: false, item: deleted }])
        }

        return deleted ? Item.get(deleted, this, this.db) : undefined
    }

    updateMany(targets: ((item: CollectionItem<CT>) => PartialDeep<Except<CollectionItem<CT>, "_id">> | Falsy) | CollectionItem<PartialDeep<CT>>[]): Stack<CT> {
        const { size } = this.getSettings()
        const { maxSize, removeAfterLimit } = this.options

        if (size === maxSize && !removeAfterLimit) {
            return new Stack([], this, this.db)
        }

        const collectedItems = this.driver.get<CollectionItem<CT>[]>(this.fullName, [])
        let { updated, newData } = this.algo.updateMany(collectedItems, targets)


        if (maxSize) {
            const getSize = () => calculateSize(this.driver.encode(newData))
            while (getSize() > maxSize) {
                if (!removeAfterLimit) {
                    const deletedItem = updated.pop();
                    if (deletedItem) {
                        const index = newData.findIndex(item => item._id === deletedItem._id)
                        const prevItem = collectedItems.find(item => item._id === deletedItem._id)
                        prevItem && (newData[index] = prevItem)
                    }
                } else {
                    const deletedItem = newData.shift();
                    if (deletedItem) {
                        updated = updated.filter(item => item._id !== deletedItem._id)
                    }
                }
            }
        }

        this.driver.set<CollectionItem<CT>[]>(this.fullName, newData)

        this._events.emit("update", [{ collection: this, isMany: true, item: updated }])

        return new Stack(updated, this, this.db)
    }

    updateOne(target: ((item: CollectionItem<CT>) => PartialDeep<Except<CollectionItem<CT>, "_id">> | Falsy) | CollectionItem<PartialDeep<CT>>): Item<CT> | undefined {
        const { size } = this.getSettings()
        const { maxSize, removeAfterLimit } = this.options

        if (size === maxSize && !removeAfterLimit) {
            return undefined
        }

        const collectedItems = this.driver.get<CollectionItem<CT>[]>(this.fullName, [])
        let { updated, newData } = this.algo.updateOne(collectedItems, target)


        if (maxSize) {
            const getSize = () => calculateSize(this.driver.encode(newData))
            while (getSize() > maxSize) {
                if (removeAfterLimit) {
                    if (newData[0]._id === updated?._id) {
                        return undefined
                    }
                    newData.shift();
                } else {
                    return undefined
                }
            }
        }

        this.driver.set<CollectionItem<CT>[]>(this.fullName, newData)

        if (updated) {
            this._events.emit("update", [{ collection: this, isMany: false, item: updated }])
        }

        return updated ? Item.get(updated, this, this.db) : undefined
    }

    getSettings(): CollectionMetaData {
        return this.db.getSettings().collections.find(c => c.name === this.name) || this.metadata
    }

    updateSettings(settings: PartialDeep<CollectionMetaData> | ((prev: CollectionMetaData) => PartialDeep<CollectionMetaData>) | undefined) {
        const prev = this.getSettings()
        const newSettings = merge(prev, settings instanceof Function ? settings(prev) : (settings || {})) as CollectionMetaData

        this.db.updateSettings(({ collections }) => {
            const index = collections.findIndex(c => c.name === this.name)
            index > -1 ? (settings === undefined ? collections.splice(index, 1) : collections[index] = newSettings) : settings && collections.push(newSettings)
            return { collections }
        })
    }

    drop() {
        this.expirationInterval && clearInterval(this.expirationInterval)
        this.deleteMany()
        this.updateSettings(undefined)
        this._events.emit("drop", [{ collection: this }])
    }

    private startExpiration() {
        const { every, key, handler } = this.options.expiration
        if (key) {
            const expire = () => {
                const items = this.deleteMany((item) => handler({
                    item,
                    collection: this,
                    key: key as keyof CT
                }))

                if (items) {
                    this._events.emit("expire", [{ collection: this, items: items.toArray() }])
                }
            }

            expire()

            if (every && every > 0) {
                this.expirationInterval = setInterval(expire, every * 1000)
            }
        }
    }

    get events(): Pick<EventListener<Events<CT>>, "on" | "off"> {
        return {
            on: this._events.on,
            off: this._events.off,
        }
    }
}