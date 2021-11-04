import { Database } from "./Database";
import { DatabaseOptions } from "./interface";

export class StorageORM {
    public db(name: string, options: DatabaseOptions) {
        return Database.open(name, options)
    }

    public dropAllDatabases() {
        Database.dropAll()
    }
}