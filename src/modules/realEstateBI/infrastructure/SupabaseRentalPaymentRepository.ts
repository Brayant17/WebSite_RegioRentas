// infrastructure/supabase/repositories/SupabaseRentalPaymentRepository.ts
import type { RentalPaymentRepository } from "@/modules/realEstateBI/domain/repositories/RentalPaymentRepository";
import { RentalPayment } from "@/modules/realEstateBI/domain/entities/RentalPayment";
import { supabase } from "@/lib//supabaseClient";
import {
    mapRentalPaymentFromDb,
    mapRentalPaymentToDb
} from "./mappers/rentalPaymentMapper";

export class SupabaseRentalPaymentRepository
    implements RentalPaymentRepository {

    async save(payment: RentalPayment): Promise<void> {
        const { error } = await supabase
            .from("rental_payments")
            .insert(mapRentalPaymentToDb(payment));

        if (error) {
            throw new Error(error.message);
        }
    }

    async findByContract(contractId: string): Promise<RentalPayment[]> {
        const { data, error } = await supabase
            .from("rental_payments")
            .select("*")
            .eq("contract_id", contractId)
            .order("due_date");

        if (error) {
            throw new Error(error.message);
        }

        return data.map(mapRentalPaymentFromDb);
    }

    async markAsPaid(paymentId: string): Promise<void> {
        const { error } = await supabase
            .from("rental_payments")
            .update({ status: "paid" })
            .eq("id", paymentId);

        if (error) {
            throw new Error(error.message);
        }
    }
}
