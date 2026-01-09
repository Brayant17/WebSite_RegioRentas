// domain/entities/Unit.ts
export class Unit {
    constructor(
        public readonly propertyId: string,
        public readonly id: string,
        public readonly monthlyRent: number
    ) {
        
     }
}
