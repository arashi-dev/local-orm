import { Driver } from "./drivers/interface"
import { Collection } from "./Collection"

export type ID = string | number
export type CollectionItem<CT extends object> = { _id: ID } & CT
export type Falsy = false | 0 | "" | null | undefined

export interface CollectionOptions<CT extends object> {
    maxSize?: number | false;
    maxLength?: number | false;
    removeAfterLimit?: boolean;
    group?: string | null;
    expiration?: {
        key?: keyof CT | null;
        every?: number | false;
        handler?: (contexts: { item: CollectionItem<CT>; collection: Collection<CT>, key: keyof CT }) => boolean
    };
    refs?: { [key: string]: (string | ((data: CollectionItem<CT>) => unknown)) }
}

export type DatabaseOptions = {
    driver: Driver | Driver[];
    group?: string;
}

export interface CollectionMetaData {
    name: string;
    last: number;
    size: number;
    length: number;
    fullSize: number;
}

export interface DatabaseSettings {
    name: string;
    collections: CollectionMetaData[];
}


// utils

type Join<K, P> = K extends string | number ?
    P extends string | number ?
    `${K}${"" extends P ? "" : "."}${P}`
    : never : never;

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20, ...0[]]

type Paths<T, D extends number = 10> = [D] extends [never] ? never : T extends object ?
    { [K in keyof T]-?: K extends string | number ?
        `${K}` | Join<K, Paths<T[K], Prev[D]>>
        : never
    }[keyof T] : ""

type Leaves<T, D extends number = 10> = [D] extends [never] ? never : T extends object ?
    { [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>> }[keyof T] : "";
