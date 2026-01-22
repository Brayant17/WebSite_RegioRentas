// domain/entities/RentalContract.ts
export type ContractStatus = 'active' | 'terminated' | 'expired'

export class RentalContract {
    constructor(
        public readonly id: string,

        // Relaciones
        public readonly unitId: string,
        public readonly startDate: Date,
        public readonly endDate: Date | null,

        // Finanzas
        public readonly monthlyRent: number,
        public readonly paymentDay: number, // Ej: día 5 de cada mes

        // Estado
        public readonly status: ContractStatus,

        // Metadata
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) { }
}
