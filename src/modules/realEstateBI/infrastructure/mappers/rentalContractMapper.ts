// infrastructure/supabase/mappers/rentalContractMapper.ts
import { RentalContract, type ContractStatus } from "@/modules/realEstateBI/domain/entities/RentalContract";

export function mapRentalContractFromDb(row: any): RentalContract {
    return new RentalContract(
        row.id,
        row.unit_id,
        new Date(row.start_date),
        row.end_date ? new Date(row.end_date) : null,
        row.monthly_rent,
        row.payment_day,
        row.status as ContractStatus,
        new Date(row.created_at),
        new Date(row.updated_at)
    );
}

export function mapRentalContractToDb(contract: RentalContract) {
    return {
        id: contract.id,
        unit_id: contract.unitId,
        start_date: contract.startDate,
        end_date: contract.endDate,
        monthly_rent: contract.monthlyRent,
        payment_day: contract.paymentDay,
        status: contract.status
    };
}
