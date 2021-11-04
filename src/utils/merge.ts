import deepmerge, { Options } from "deepmerge"
import { Merge } from "type-fest"

// const merge = <A extends { [key: string]: any }, B extends { [key: string]: any }>(a: A, b: B): Merge<A, B> => {
//     const obj: { [key: string]: any } = {}

//     for (const key in a) {
//         const aItem = a[key]
//         const bItem = b[key]
//         if (typeof aItem === "object" && typeof bItem === "object") {
//             obj[key] = merge(aItem, bItem)
//         }
//         obj[key] = bItem || aItem
//     }

//     for (const key in b) {
//         const bItem = b[key]

//         if (key in obj === false) {
//             obj[key] = bItem
//         }
//     }

//     return obj as Merge<A, B>
// }

export const merge = <T, T2 = T>(a: T, b: T2, options?: Options): T & T2 => deepmerge(a, b, { ...options, arrayMerge: (_, source) => source }) as T & T2