import { Maintenance } from "../entities/Maintenance"

export interface MaintenanceRepository {
  findByUnitIds(unitIds: string[]): Promise<Maintenance[]>
}
