// domain/repositories/ContractRepository.ts
import { Contract } from "../entities/Contract"

export interface ContractRepository {
  findAll(): Promise<Contract[]>
}