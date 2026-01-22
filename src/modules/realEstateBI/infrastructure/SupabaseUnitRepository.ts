import type { UnitFilter, UnitRepository } from "@/modules/realEstateBI/domain/repositories/UnitRepository";
import { Unit } from "@/modules/realEstateBI/domain/entities/Unit";
import { supabase } from "@/lib/supabaseClient";
import { mapUnitFromDb, mapUnitToDb } from "./mappers/unitMapper";
import type { UnitDetailsDto } from "@/modules/realEstateBI/application/dtos/UnitDetailsDto";
import type { UnitRecordDto } from "../application/dtos/UnitRecordDto";
import { mapUnitRecordToDetailsDto } from "./mappers/mapUnitRecordToDetailsDto";
import type { UnitCardDto } from "../application/dtos/UnitCardDto";

export class SupabaseUnitRepository implements UnitRepository {

    async save(unit: Unit): Promise<void> {
        const { error } = await supabase
            .from("rental_units")
            .insert({
                rental_property_id: unit.getPropertyID(),
                codigo: unit.getCode(),
                nombre: unit.getName(),
                tipo: unit.getType(),
                piso: unit.getFloor(),
                area_m2: unit.getArea(),
                recamaras: unit.getBedrooms(),
                banos: unit.getBathrooms(),
                estacionamientos: unit.getParkingSpots(),
                estado: unit.getStatus(),
                precio_renta: unit.getMonthlyRent(),
                moneda: unit.getCurrency(),
                descripcion: unit.getDescription(),
                amueblado: unit.getFurnished(),
                activo: unit.isActive(),
            });

        if (error) {
            throw new Error(error.message);
        }
    }

    async update(unit: Unit): Promise<void> {
        const { error } = await supabase
            .from("rental_units")
            .update(mapUnitToDb(unit))
            .eq("id", unit.getID());

        if (error) {
            throw new Error(error.message);
        }
    }

    async findById(id: string): Promise<Unit | null> {
        const { data, error } = await supabase
            .from("rental_units")
            .select("*")
            .eq("id", id)
            .single();

        if (error && error.code !== "PGRST116") {
            throw new Error(error.message);
        }

        return data ? mapUnitFromDb(data) : null;
    }

    async findByProperty(propertyId: string): Promise<UnitDetailsDto[]> {
        const { data, error } = await supabase
            .from("rental_units")
            .select("*")
            .eq("rental_property_id", propertyId)

        if (error) {
            throw new Error(error.message);
        }

        return (data as UnitRecordDto[]).map(mapUnitRecordToDetailsDto);
    }

    async getUnitCards(propertyId: string, filter: UnitFilter): Promise<UnitCardDto[]> {
        const { data, error } = await supabase.rpc("get_unit_cards", {
            p_property_id: propertyId,
            p_filter: filter,
        });

        if (error) throw error;

        console.log(data);

        return (data as any[]).map(row => ({
            id: row.unit_id,     
            code: row.code, // error por el codigo Cannot read properties of undefined
            name: row.name,
            floor: row.floor,
            status: row.status,
            features: row.features,
            rent: row.rent ? `$${row.rent}` : null,
            tenant: row.tenant_name
                ? { name: row.tenant_name }
                : undefined,
            expiry: row.contract_expiry ?? undefined,
        }));
    }
}
