import { PartialDeep } from "type-fest";
import { Driver } from "./drivers/interface";
import { merge } from "./utils/merge";
import { Database } from "./Database";
import { DatabaseSettings } from "./interface";
import { SETTINGS_NAME } from "./constants";

export class Settings {
    private static settings: { [key: string]: Settings } = {};
    private _settings: DatabaseSettings

    public static get(db: Database, driver: Driver, defaultSettings: DatabaseSettings) {
        return Settings.settings[db.name] ||= new Settings(db, driver, defaultSettings)
    }

    private constructor(private db: Database, private driver: Driver, private defaultSettings: DatabaseSettings) {
        const prev = this.fromStorage()
        if (prev) {
            this._settings = prev
        } else {
            this._settings = this.defaultSettings
            this.update(this.defaultSettings)
        }
    }

    public update(settings: PartialDeep<DatabaseSettings> | ((prev: DatabaseSettings) => PartialDeep<DatabaseSettings>)) {
        this.driver.set<DatabaseSettings[]>(SETTINGS_NAME, (prev = []) => {
            const index = prev.findIndex(item => item.name === this.db.name)
            const prevSettings = prev[index] || this.defaultSettings
            this._settings = merge(prevSettings, settings instanceof Function ? settings(prevSettings) : settings) as DatabaseSettings
            index > -1 ? (prev[index] = this._settings) : prev.push(this._settings)
            return prev
        })
    }

    public fromStorage(): DatabaseSettings | undefined {
        const databases = this.driver.get<DatabaseSettings[]>(SETTINGS_NAME, [])
        return databases.find(db => db.name === this.db.name)
    }

    public get settings() {
        return this._settings
    }
}