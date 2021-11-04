import deepmerge from "deepmerge";
import { Driver } from "./interface"

interface DriverOptions {
    cacheInMemory: boolean
}

export class LocalStorage implements Driver {
    private memory: { [key: string]: any } = {};
    private options: DriverOptions = {
        cacheInMemory: true,
    }

    constructor(options?: Partial<DriverOptions>) {
        options && (this.options = deepmerge(this.options, options))
    }

    get<T = any>(key: string, defaultValue?: T): T {
        if (this.options.cacheInMemory && this.memory[key]) return this.memory[key]

        try {
            const data = localStorage.getItem(key)
            if (data) {
                const decodedData = this.decode<T>(data)
                if (this.options.cacheInMemory) this.memory[key] = decodedData
                return decodedData
            }
            return defaultValue as T
        } catch {
            return defaultValue as T
        }
    }

    set<T>(key: string, value: T | ((prev: T) => T)): string {
        const data = value instanceof Function ? value(this.get(key)) : value
        const encodedData = this.encode(data)
        localStorage.setItem(key, encodedData)
        if (this.options.cacheInMemory) this.memory[key] = data
        return encodedData
    }

    drop(key: string) {
        localStorage.removeItem(key)
        if (this.options.cacheInMemory) delete this.memory[key]
    }

    decode<T>(value: string): T {
        return JSON.parse(value)
    }

    encode<T>(value: T): string {
        return JSON.stringify(value)
    }

    isSupport() {
        return typeof localStorage !== "undefined"
    }
}