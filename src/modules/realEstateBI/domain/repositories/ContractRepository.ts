// domain/repositories/ContractRepository.ts
import { Contract } from "../entities/RentalContract"

export interface ContractRepository {
  findAll(): Promise<Contract[]>
}