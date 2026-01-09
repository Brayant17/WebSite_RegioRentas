// domain/entities/Property.ts
export class Property {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly address: string,
        public readonly city?: string,
        public readonly state?: string,
        public readonly postalCode?: string,
        private active: boolean = true
    ) {
        // validaciones
        this.validate();
    }

    private validate() {
        // Aquí puedes agregar validaciones adicionales si es necesario
        if (!this.name) throw new Error('Property must have a name');
        if (!this.address) throw new Error('Property must have an address');
    }

    deactive() {
        this.active = false;
    }

    isActive(): boolean {
        return this.active;
    }

}