export type SignatureProcessStatus = "PENDIENTE" | "COMPLETADO" | "CANCELADO";

export interface SignatureProcessSigner {
  id: string;
  rol: string;
  nombre_entidad: string;
  caracter: string;
  estado: "PENDIENTE" | "FIRMADO";
  firmado_at: string | null;
}

export interface SignatureInvitationState {
  firmanteId: string;
  estado: "VIGENTE" | "VENCIDA" | "REVOCADA" | "USADA";
  emitidaAt: string;
  expiraAt: string;
}

export interface SignatureProcess {
  id: string;
  contrato_id: string;
  documento_origen_id: string;
  estado: SignatureProcessStatus;
  iniciado_at: string;
  cancelado_at: string | null;
  motivo_cancelacion: string | null;
  documento: { numero_version: number; nombre_archivo: string } | null;
  firmantes: SignatureProcessSigner[];
}
