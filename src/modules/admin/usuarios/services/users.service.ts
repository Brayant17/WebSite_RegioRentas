import { listUsers, deleteUser, listPendingRequest } from "../repositories/user.repository"
import type { User, UserFilters } from "../types"

export async function fetchUsers(filters: UserFilters, page: number, limit: number = 10) {
  const listUsersResult = await listUsers(filters, page, limit)
  // lógica de negocio si necesitas
  return listUsersResult
}

export async function fetchPendingRequest() {
  const listPendingRequestResult = await listPendingRequest()
  // lógica de negocio si necesitas
  return listPendingRequestResult
}

export async function removeUser(id: string) {
  // podrías validar cosas aquí
  if (!id) {
    throw new Error("User ID requerido")
  }

  await deleteUser(id)
}
