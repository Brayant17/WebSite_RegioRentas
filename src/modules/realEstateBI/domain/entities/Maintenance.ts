// domain/entities/Maintenance.ts
export class Maintenance {
    constructor(
        public readonly id: string,
        public readonly unitId: string,
        public readonly type: "climate" | "general",
        public readonly date: Date,
        public readonly cost: number
    ) { }

    requiresClimateMaintenance(
        months: number,
        on: Date = new Date()
    ): boolean {
        if (this.type !== "climate") return false

        const diff =
            (on.getTime() - this.date.getTime()) / (1000 * 60 * 60 * 24 * 30)

        return diff >= months
    }
}
