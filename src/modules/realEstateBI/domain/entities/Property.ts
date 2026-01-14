// domain/entities/Property.ts
export class Property {
    constructor(
        public readonly id: string,
        private name: string,
        private address: string,
        private city?: string,
        private state?: string,
        private postalCode?: string,
        private active: boolean = true
    ) {
        // validaciones
        this.validate();
    }

    // Getters
    getName(): string {
        return this.name;
    }

    getAddress(): string {
        return this.address
    }

    getCity(): string | undefined {
        return this.city
    }

    getState(): string | undefined {
        return this.state
    }

    getPostalCode(): string | undefined {
        return this.postalCode;
    }

    updateDetails(data: {
        name: string,
        address: string,
        city?: string,
        state?: string,
        postalCode?: string,
    }) {
        this.name = data.name
        this.address = data.address
        this.city = data.city
        this.state = data.state
        this.postalCode = data.postalCode

        this.validate();
    }

    activate() {
        this.active = true
    }

    deactive() {
        this.active = false;
    }

    isActive(): boolean {
        return this.active;
    }

    private validate() {
        // Aquí puedes agregar validaciones adicionales si es necesario
        if (!this.name) throw new Error('Property must have a name');
        if (!this.address) throw new Error('Property must have an address');
    }
}