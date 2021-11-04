import { PartialDeep } from "type-fest"
import { Collection } from "./Collection"
import { Database } from "./Database"
import { CollectionItem } from "./interface"
import { Item } from "./Item"

export class Stack<CT extends object> {
    private _items: Item<CT>[] = []

    constructor(private objects: CollectionItem<CT>[], private collection: Collection<CT>, private db: Database) {
        objects.forEach((obj) => {
            this._items.push(Item.get(obj, collection, db))
        })
    }

    toArray() {
        return this.objects
    }

    getIds() {
        return this.objects.map(({ _id }) => _id)
    }

    get items() {
        return this._items
    }

    get length() {
        return this._items.length
    }

    sync() {
        const stack = this.collection.findMany(this.getIds() as PartialDeep<CollectionItem<CT>>)
        this.objects = stack.toArray()
        this._items = this._items
    }
}