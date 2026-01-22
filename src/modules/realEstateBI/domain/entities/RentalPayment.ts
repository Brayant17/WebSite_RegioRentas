// domain/entities/RentalPayment.ts
export type PaymentStatus = 'pending' | 'paid' | 'overdue'

export class RentalPayment {
    constructor(
        public readonly id: string,

        // Relación
        public readonly contractId: string,

        // Periodo
        public readonly period: string, // '2025-01'

        // Finanzas
        public readonly amount: number,
        public readonly dueDate: Date,

        // Estado
        public readonly status: PaymentStatus,

        // Metadata
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) { }
}
