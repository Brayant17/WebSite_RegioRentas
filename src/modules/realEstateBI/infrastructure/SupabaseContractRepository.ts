// infrastructure/SupabaseContractRepository.ts
import type { ContractRepository, ContractScope } from "@/modules/realEstateBI/domain/repositories/ContractRepository"
import { supabase } from "@/lib/supabaseClient"
import { mapToContract } from "./mappers/mapToContract"
import type { Contract } from "../domain/entities/Contract"

export class SupabaseContractRepository
    implements ContractRepository {

    async findByScope(scope: Contract): Promise<Contract[]> {
        const { data, error } = await supabase
            .from("contracts")
            .select("*")

        if (error) {
            throw new Error(error.message)
        }

        if (!data) {
            return []
        }

        return data.map(mapToContract)
    }
}
