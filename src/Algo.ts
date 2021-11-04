import { Except, PartialDeep } from "type-fest"
import { merge } from "./utils/merge"
import { objectIncludes } from "./utils/objectIncludes"
import { CollectionItem, Falsy } from "./interface"

export class Algo<CT extends object> {
    public findMany(datas: CollectionItem<CT>[], target?: ((item: CollectionItem<CT>) => boolean) | PartialDeep<CollectionItem<CT>>): CollectionItem<CT>[] {
        if (typeof target === "undefined") return datas
        return datas.filter(item => typeof target === "function" ? target(item) : objectIncludes(target, item))
    }

    public findOne(datas: CollectionItem<CT>[], target?: ((item: CollectionItem<CT>) => boolean) | PartialDeep<CollectionItem<CT>>): CollectionItem<CT> | undefined {
        if (typeof target === "undefined") return datas[0]
        return datas.find(item => typeof target === "function" ? target(item) : objectIncludes(target, item))
    }

    public insertMany(datas: CollectionItem<CT>[], target: CollectionItem<CT>[]): CollectionItem<CT>[] {
        return datas.concat(target)
    }

    public insertOne(datas: CollectionItem<CT>[], target: CollectionItem<CT>): CollectionItem<CT>[] {
        const clone = datas.slice(0)
        clone.push(target)
        return clone
    }

    public deleteMany(datas: CollectionItem<CT>[], target?: ((item: CollectionItem<CT>) => boolean) | PartialDeep<CollectionItem<CT>>): { deleted: CollectionItem<CT>[], newData: CollectionItem<CT>[] } {
        if (typeof target === "undefined") return { deleted: datas, newData: [] }

        const deleted: CollectionItem<CT>[] = []
        const newData = datas.filter(item => {
            const result = typeof target === "function" ? target(item) : objectIncludes(target, item)
            if (result) deleted.push(item)
            return !result
        })

        return {
            deleted,
            newData
        }
    }

    public deleteOne(datas: CollectionItem<CT>[], target?: ((item: CollectionItem<CT>) => boolean) | PartialDeep<CollectionItem<CT>>): { deleted: CollectionItem<CT> | undefined, newData: CollectionItem<CT>[] } {
        if (typeof target === "undefined") return { deleted: datas[0], newData: datas.splice(0).splice(1) }

        let deleted: CollectionItem<CT> | undefined = undefined;
        const newData = datas.filter(item => {
            if (!deleted) {
                const result = typeof target === "function" ? target(item) : objectIncludes(target, item)
                if (result) {
                    deleted = item
                    return false
                }
            }
            return true
        })

        return {
            deleted,
            newData
        }
    }

    public updateMany(datas: CollectionItem<CT>[], targets: ((item: CollectionItem<CT>) => PartialDeep<Except<CollectionItem<CT>, "_id">> | Falsy) | CollectionItem<PartialDeep<CT>>[]): { updated: CollectionItem<CT>[], newData: CollectionItem<CT>[] } {
        const targetsObj: { [key: string]: CollectionItem<PartialDeep<CT>> } = {}

        if (targets instanceof Array) {
            targets.forEach((target) => {
                targetsObj[target._id] = target
            })
        }

        const updated: CollectionItem<CT>[] = []
        const newData = datas.map(item => {
            let result: CollectionItem<CT> | Falsy;
            if (typeof targets === "function") {
                const res = targets(item)
                res && (result = merge(item, targets(item)))
            } else {
                if (targetsObj[item._id]) {
                    result = merge(item, targetsObj[item._id])
                }
            }

            if (result) result._id = item._id

            result && updated.push(result)

            return result || item
        })

        return {
            updated,
            newData
        }
    }

    public updateOne(datas: CollectionItem<CT>[], target: ((item: CollectionItem<CT>) => PartialDeep<Except<CollectionItem<CT>, "_id">> | Falsy) | CollectionItem<PartialDeep<CT>>): { updated?: CollectionItem<CT>, newData: CollectionItem<CT>[] } {
        let updated: CollectionItem<CT> | undefined;
        const newData: CollectionItem<CT>[] = []

        for (const item of datas) {
            if (!updated) {
                const result = (typeof target === "function" ? target(item) : (target._id === item._id ? target : undefined)) as CollectionItem<CT>
                if (result) {
                    result._id = item._id
                    const merged = merge(item, result)
                    updated = merged
                    newData.push(merged)
                } else {
                    newData.push(item)
                }
            } else {
                newData.push(item)
            }
        }

        return {
            updated,
            newData
        }
    }
}