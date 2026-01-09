// domain/entities/Payment.ts
export class Payment {
    constructor(
        // public readonly id: string,
        public readonly contractId: string,
        public readonly period: string, // YYYY-MM
        public readonly amount: number,
        public readonly dueDate: Date,
        public readonly paidAt?: Date
    ) { }

    isPaid(): boolean {
        return !!this.paidAt
    }

    isOverdue(on: Date = new Date()): boolean {
        return !this.isPaid() && on > this.dueDate
    }
}
