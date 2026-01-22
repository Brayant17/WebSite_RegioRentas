// infrastructure/supabase/mappers/rentalPaymentMapper.ts
import { RentalPayment, type PaymentStatus } from "@/modules/realEstateBI/domain/entities/RentalPayment";

export function mapRentalPaymentFromDb(row: any): RentalPayment {
    return new RentalPayment(
        row.id,
        row.contract_id,
        row.period,
        row.amount,
        new Date(row.due_date),
        row.status as PaymentStatus,
        new Date(row.created_at),
        new Date(row.updated_at)
    );
}

export function mapRentalPaymentToDb(payment: RentalPayment) {
    return {
        id: payment.id,
        contract_id: payment.contractId,
        period: payment.period,
        amount: payment.amount,
        due_date: payment.dueDate,
        status: payment.status
    };
}
