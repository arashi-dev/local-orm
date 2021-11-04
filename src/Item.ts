import { Except, Merge, PartialDeep } from "type-fest"
import { Collection } from "./Collection"
import { CollectionItem, ID } from "./interface"
import objectPath from "object-path"
import { Database } from "./Database"
import deepmerge from "deepmerge"

type EventCallback<CT extends object> = (contexts: { item: CollectionItem<CT>, collection: Collection<CT> }) => void
type Events = "delete" | "update"

// type Refs<CT extends object> = Item<CT>['collection']['options']['refs']

// type DataWithFunc<CT extends object> = Merge<CollectionItem<CT>, { [key in keyof Refs<CT>]: Refs<CT>[key] extends () => any ? Refs<CT>[key] : <T>() => T}>

export class Item<CT extends object> {
    private static items: { [key: string]: Item<object> } = {}
    private eventCleanups: [Events | Events[], EventCallback<CT>, () => void][] = []
    // private dataWithFunc: DataWithFunc<CT>
    private dataWithFunc: CollectionItem<CT>
    private prevData: CollectionItem<CT> | null = null;

    public static get<CT extends object>(data: CollectionItem<CT>, collection: Collection<CT>, db: Database) {
        const dbFullName = db.options.group ? `${db.options.group}:${db.name}` : db.name
        const collectionFullName = collection.options.group ? `${collection.options.group}:${collection.name}` : collection.name
        const fullName = [dbFullName, collectionFullName, data._id].join(":")
        return (Item.items[fullName] ||= new Item<CT>(data, collection, db) as unknown as Item<object>) as unknown as Item<CT>
    }


    private constructor(private _data: CollectionItem<CT>, private collection: Collection<CT>, private db: Database) {
        this.dataWithFunc = this.makeDataWithFun(_data)
        this.on("update", ({ item }) => {
            this.prevData = { ...this._data }
            this._data = item
            this.dataWithFunc = this.makeDataWithFun(item)
        })
    }

    private getTargetHandler(source: string, target: string) {
        const parts = target.split(".")
        const collectionName = parts.shift()
        const path = parts.length > 0 ? parts : ["_id"]
        const siblings = this.collection.siblings

        for (const collection of siblings) {
            if (collection.name === collectionName) {
                const item = collection.findOne((item) => {
                    if (objectPath.get(this._data, source) == objectPath.get(item, path)) {
                        return true
                    }
                    return false
                })

                return item
            }
        }
    }

    private makeDataWithFun(data: CollectionItem<CT>) {
        const dataClone = { ...data }
        const { refs } = this.collection.options
        const clone = refs as { [key: string]: string | ((data: CollectionItem<CT>) => unknown) }
        for (const source in clone) {
            const target = clone[source]
            if (typeof target === "string") {
                objectPath.set(dataClone, source, () => this.getTargetHandler(source, target))
            } else {
                objectPath.set(dataClone, source, () => target(this.rawData))
            }
        }
        // this.dataWithFunc = dataClone as DataWithFunc<CT>
        return dataClone
    }

    public on(event: Events | Events[], callback: EventCallback<CT>) {
        const listener = ({ item }: any) => {
            if (item instanceof Array) {
                const index = item.findIndex(({ _id }) => _id === this._data._id)
                if (index > -1) {
                    // const isChanged = JSON.stringify(item[index]) !== JSON.stringify(this.prevData)
                    // if (isChanged) {
                    callback({ item: item[index], collection: this.collection })
                    // }
                }
            } else {
                if (item._id === this._data._id) {
                    // const isChanged = JSON.stringify(item) !== JSON.stringify(this.prevData)
                    // if (isChanged) {
                    callback({ item, collection: this.collection })
                    // }
                }
            }
        }
        const cleanup = this.collection.events.on(event, listener)

        this.eventCleanups.push([event, callback, cleanup])

        return () => this.off(event, callback)
    }

    public off(event: Events | Events[], callback: EventCallback<CT>) {
        this.eventCleanups = this.eventCleanups.filter(([evt, cb, cleanup]) => {
            if (evt === event && cb === callback) {
                cleanup()
                return false
            }
            return true
        })
    }

    public update(data: PartialDeep<Except<CollectionItem<CT>, "_id">> | ((prev: CollectionItem<CT>) => PartialDeep<Except<CollectionItem<CT>, "_id">>)) {
        return this.collection.updateOne(prev => prev._id === this._data._id ? (data instanceof Function ? data(prev) : data) : false)
    }

    public delete() {
        const dbFullName = this.db.options.group ? `${this.db.options.group}:${this.db.name}` : this.db.name
        const collectionFullName = this.collection.options.group ? `${this.collection.options.group}:${this.collection.name}` : this.collection.name
        const fullName = [dbFullName, collectionFullName, this.data._id].join(":")
        delete Item.items[fullName]

        this.collection.deleteOne({ _id: this._data._id } as PartialDeep<CollectionItem<CT>>)
    }

    public sync() {
        const item = this.collection.findOne({ _id: this._data._id } as PartialDeep<CollectionItem<CT>>)
        if (item) {
            this.dataWithFunc = this.makeDataWithFun(item._data)
            this._data = item._data
        }
    }

    public get data() {
        return this.dataWithFunc
    }

    public get rawData() {
        return this._data
    }
}