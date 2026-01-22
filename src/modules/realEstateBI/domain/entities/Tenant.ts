// domain/entities/Tenant.ts
export class Tenant {
    constructor(
        public readonly id: string,

        // Datos personales
        public readonly fullName: string,
        public readonly email: string | null,
        public readonly phone: string | null,

        // Metadata
        public readonly createdAt: Date,
        public readonly updatedAt: Date
    ) { }
}
