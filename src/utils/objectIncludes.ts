export const objectIncludes = (a: { [key: string]: unknown }, b: { [key: string]: unknown }): boolean => {
    for (const key in a) {
        const aItem = a[key]
        const bItem = b[key]

        if (typeof aItem !== typeof bItem) return false

        if (aItem instanceof Array && bItem instanceof Array) {
            const result = aItem.some((item) => bItem.includes(item))
            if (!result) return false
        } else if (aItem instanceof Array || bItem instanceof Array) {
            return false
        } else if (typeof aItem === "object" && typeof bItem === "object") {
            if (!objectIncludes(aItem as {}, bItem as {})) return false
        } else if (aItem !== bItem) {
            return false
        }
    }

    return true
}