// infrastructure/supabase/repositories/SupabaseRentalContractRepository.ts
import type { RentalContractRepository } from "@/modules/realEstateBI/domain/repositories/RentalContractRepository";
import { RentalContract } from "@/modules/realEstateBI/domain/entities/RentalContract";
import { supabase } from "@/lib/supabaseClient";
import {
    mapRentalContractFromDb,
    mapRentalContractToDb
} from "./mappers/rentalContractMapper";

export class SupabaseRentalContractRepository
    implements RentalContractRepository {

    async save(contract: RentalContract): Promise<void> {
        const { error } = await supabase
            .from("rental_contracts")
            .insert(mapRentalContractToDb(contract));

        if (error) {
            throw new Error(error.message);
        }
    }

    async findActiveByUnitId(unitId: string): Promise<RentalContract | null> {
        const { data, error } = await supabase
            .from("rental_contracts")
            .select("*")
            .eq("unit_id", unitId)
            .eq("status", "active")
            .single();

        if (error && error.code !== "PGRST116") {
            throw new Error(error.message);
        }

        return data ? mapRentalContractFromDb(data) : null;
    }
}
