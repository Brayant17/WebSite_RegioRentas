// application/generateMonthlyPayments.ts
import type { ContractRepository } from "../domain/repositories/ContractRepository"
import type { PaymentRepository } from "../domain/repositories/PaymentRepository"
import { Payment } from "@/modules/realEstateBI/domain/entities/Payment"

export class GenerateMonthlyPayments {
    constructor(
        private contractRepo: ContractRepository,
        private paymentRepo: PaymentRepository
    ) { }

    async execute(period: string) {
        const [year, month] = period.split("-").map(Number)
        const periodStart = new Date(year, month - 1, 1)
        const periodEnd = new Date(year, month, 0)

        const contracts = await this.contractRepo.findAll()

        let created = 0
        let skipped = 0

        for (const contract of contracts) {
            if (!contract.isActiveInPeriod(periodStart, periodEnd)) continue

            const exists = await this.paymentRepo.exists(contract.id, period)

            if (exists) {
                skipped++
                continue
            }

            const dueDate = new Date(year, month - 1, 10) // regla: día 10

            const payment = new Payment(
                contract.id,
                period,
                contract.monthlyRent,
                dueDate
            )

            await this.paymentRepo.save(payment)
            created++
        }

        return { period, created, skipped }
    }
}
