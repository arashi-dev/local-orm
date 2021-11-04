export class EventListener<Events extends { [event: string]: (...args: any[]) => any }> {
    private events: { [event in keyof Events]?: (Events[keyof Events])[] } = {};

    private toArray<T>(data: T | T[]): T[] {
        if (data instanceof Array) {
            return data
        }
        return [data]
    }

    on = <E extends keyof Events, C extends Events[E]>(event: E | E[], callback: C): (() => void) => {
        const events = this.toArray(event)
        events.forEach(event => {
            this.events[event] ||= []
            this.events[event]?.push(callback)
        })

        return () => {
            this.off(events, callback)
        }
    }

    off = <E extends keyof Events, C extends Events[E]>(event: E | E[], callback: C) => {
        const events = this.toArray(event)
        events.forEach((event) => {
            this.events[event] ||= []
            const index = this.events[event]?.indexOf(callback) || -1
            if (index > -1) {
                this.events[event]?.splice(index, 1)
            }
        })
    }

    emit = <E extends keyof Events, C extends Events[E]>(event: E | E[], args: Parameters<C>) => {
        const events = this.toArray(event)
        events.forEach(() => {
            const events = this.events[event as string]
            if (events?.length) {
                events.forEach(cb => {
                    cb(...args)
                })
            }
        })
    }
}