// domain/entities/Unit.ts
export type UnitStatus = 'Ocupado' | 'Disponible' | 'Mantenimiento';
export type UnitType = | 'DEPARTAMENTO' | 'CASA' | 'OFICINA' | 'LOCAL_COMERCIAL' | 'BODEGA' | 'ESTACIONAMIENTO'
export type Currency = 'MXN' | 'USD';

interface UnitProps {
    id: string;
    propertyId: string;

    // Identificación
    code: string;
    name: string;
    type: UnitType;

    // Características físicas
    floor?: number | null;
    areaM2?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    parkingSpots?: number | null;
    furnished?: boolean;
    description?: string | null;

    // Finanzas
    monthlyRent: number;
    currency: Currency;

    // Estado
    status: UnitStatus;
    isActive: boolean;

    // // Metadata
    // createdAt: Date;
    // updatedAt: Date;
}


export class Unit {
    constructor(private props: UnitProps) {
        this.validate();
    }

    private validate() {
        if (this.props.monthlyRent < 0) {
            throw new Error('La renta mensual no puede ser negativa');
        }

        if (this.props.type === 'ESTACIONAMIENTO' && this.props.bedrooms) {
            throw new Error('Un estacionamiento no puede tener dormitorios');
        }
    }

    // crear los metodos get para traer los datos de unit

    getID(){
        return this.props.id;
    }

    getPropertyID() {
        return this.props.propertyId;
    }

    getCode(){
        return this.props.code;
    }

    getName(){
        return this.props.name
    }

    getType() {
        return this.props.type;
    }

    // caracterizticas
    getFloor(){
        return this.props.floor
    }

    getArea(){
        return this.props.areaM2
    }

    getBedrooms(){
        return this.props.bedrooms
    }

    getBathrooms(){
        return this.props.bathrooms
    }

    getParkingSpots(){
        return this.props.parkingSpots
    }

    getFurnished(){
        return this.props.furnished
    }

    getDescription(){
        return this.props.description
    }

    getMonthlyRent() {
        return this.props.monthlyRent;
    }

    getCurrency() {
        return this.props.currency;
    }

    getStatus(){
        return this.props.status;
    }

    isActive(){
        return this.props.isActive;
    }

    isAvailable() {
        return this.props.status === 'Disponible';
    }

    deactivate() {
        this.props.isActive = false;
        // this.props.updatedAt = new Date();
    }
}
