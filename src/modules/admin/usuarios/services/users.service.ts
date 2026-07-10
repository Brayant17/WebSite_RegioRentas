import { listUsers, deleteUser, listPendingRequest, findPendingVerificationRequests, createSignedDocumentUrls } from "../repositories/user.repository"
import type { User, UserFilters, VerificationDocument } from "../types"
import type { VerificationRequest } from "../types";

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

export async function getPendingVerificationRequest(): Promise<VerificationRequest[]> {

  const { data, error } =
    await findPendingVerificationRequests();

  console.log("Data:", data);

  if (error) throw error;

  const requests = data ?? [];

  return await Promise.all(

    requests.map(async (request) => {

      const paths =
        request.account_request_documents.map(
          doc => doc.storage_path
        );

      const { data: signedUrls, error } =
        await createSignedDocumentUrls(paths);

      if (error) {
        throw error;
      }

      const documents: VerificationDocument[] =
        request.account_request_documents.map((doc, index) => ({
          id: doc.id,
          documentType: doc.document_type,
          storagePath: doc.storage_path,
          fileName: doc.file_name,
          signedUrl: signedUrls?.[index]?.signedUrl ?? null,
        }));

      const user = Array.isArray(request.user)
        ? request.user[0]
        : request.user;

      return {
        id: request.id,

        status: request.status,

        createdAt: request.created_at,

        requestedType: request.requested_type,

        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
        },

        documents,
      };

    })

  );

}

export async function removeUser(id: string) {
  // podrías validar cosas aquí
  if (!id) {
    throw new Error("User ID requerido")
  }

  await deleteUser(id)
}
