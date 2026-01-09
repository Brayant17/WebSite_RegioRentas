// domain/repositories/PaymentRepository.ts
import { Payment } from "../entities/Payment"

export interface PaymentRepository {
  exists(contractId: string, period: string): Promise<boolean>
  save(payment: Payment): Promise<void>
}
