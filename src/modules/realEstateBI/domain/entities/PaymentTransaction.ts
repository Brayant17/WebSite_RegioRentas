// domain/entities/PaymentTransaction.ts
export class PaymentTransaction {
    constructor(
        public readonly id: string,

        // Relación
        public readonly paymentId: string,

        // Dinero
        public readonly amount: number,
        public readonly paymentDate: Date,
        public readonly method: 'cash' | 'transfer' | 'card',

        // Metadata
        public readonly createdAt: Date
    ) { }
}
