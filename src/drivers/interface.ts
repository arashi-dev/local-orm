export interface Driver {
    get<T = any>(key: string, defaultValue?: T): T;
    set<T>(key: string, value: T | ((prev: T) => T)): string;
    drop(key: string): void;
    decode<T>(value: string): T;
    encode<T>(value: T): string;
    isSupport(): boolean;
}