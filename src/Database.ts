import { Collection } from "./Collection";
import { Driver } from "./drivers/interface";
import { CollectionOptions, DatabaseOptions } from "./interface";
import { Settings } from "./Settings";

export class Database {
    private static databases: { [key: string]: Database } = {};
    private collections: Collection<object>[] = [];
    private settingsHandler: Settings;

    public static open(name: string, options: DatabaseOptions) {
        const fullName = options.group ? `${options.group}:${name}` : name
        return Database.databases[fullName] ||= new Database(name, options)
    }

    private constructor(public name: string, public options: DatabaseOptions) {
        if (options.driver instanceof Array) {
            if(!options.driver.length) throw new Error("no driver have been defined")
            const driver = options.driver.find(driver => driver.isSupport())
            options.driver = driver || options.driver[0]
        } else {
            if(!options.driver) throw new Error("no driver have been defined")
        }
        this.settingsHandler = Settings.get(this, options.driver, {
            name,
            collections: []
        })
    }

    public collection<CT extends object>(name: string, options?: CollectionOptions<CT>) {
        const collection = Collection.open<CT>(name, this.options.driver as Driver, this, options)
        this.collections.push(collection as unknown as Collection<object>)
        return collection
    }

    public drop() {
        this.collections.forEach(collection => {
            collection.drop()
        })
        this.collections = []
        delete Database.databases[this.name]
    }

    getSettings() {
        return this.settingsHandler.settings
    }

    updateSettings: Database['settingsHandler']['update'] = (settings) => {
        return this.settingsHandler.update(settings)
    }

    get databases() {
        return Database.databases
    }

    static dropAll() {
        const databases = Database.databases
        for (const name in databases) {
            const db = databases[name]
            db.drop()
        }
    }
}