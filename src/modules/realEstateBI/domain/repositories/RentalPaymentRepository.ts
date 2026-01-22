// domain/repositories/RentalPaymentRepository.ts
import { RentalPayment } from "../entities/RentalPayment";

export interface RentalPaymentRepository {
    save(payment: RentalPayment): Promise<void>;
    findByContract(contractId: string): Promise<RentalPayment[]>;
    markAsPaid(paymentId: string): Promise<void>;
}
