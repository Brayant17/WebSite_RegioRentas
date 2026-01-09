// domain/entities/Contract.ts
export class Contract {
    constructor(
        public readonly id: string,
        public readonly unitId: string,
        public readonly startDate: Date,
        public readonly endDate: Date,
        public readonly monthlyRent: number
    ) { }

    isActive(on: Date = new Date()): boolean {
        return on >= this.startDate && on <= this.endDate
    }

    isExpired(on: Date = new Date()): boolean {
        return on > this.endDate
    }

    isExpiringIn(days: number, on: Date = new Date()): boolean {
        const diff =
            (this.endDate.getTime() - on.getTime()) / (1000 * 60 * 60 * 24)
        return diff <= days && diff >= 0
    }

    isActiveInPeriod(periodStart: Date, periodEnd: Date):boolean {
        return this.startDate <= periodEnd && this.endDate >= periodStart
    }
}
