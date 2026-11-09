export type ContractStatus = "BORRADOR" | "PENDIENTE_FIRMA" | "FIRMADO" | "ACTIVO" | "FINALIZADO" | "CANCELADO" | "TERMINADO_ANTICIPADAMENTE";
export type ContractRole = "ARRENDADOR" | "ARRENDATARIO" | "FIADOR" | "OBLIGADO_SOLIDARIO" | "REPRESENTANTE_LEGAL";

export interface ContractPerson {
  id: string;
  nombre: string | null;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  telefono: string | null;
  correo: string | null;
}

export interface ContractUnit {
  nombre: string | null;
  edificio: { nombre: string | null } | null;
}

export interface Contract {
  id: string;
  solicitud_id: string;
  unidad_id: number;
  arrendador_persona_moral_id: string | null;
  folio: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  renta: number | string | null;
  deposito: number | string | null;
  dia_pago: number | null;
  fecha_firma: string | null;
  lugar_firma: string | null;
  estado: ContractStatus;
  created_at: string;
  updated_at: string;
}

export interface ContractSummary extends Contract {
  unidad: ContractUnit | null;
}

export interface ContractDetail extends ContractSummary {
  costo_lavanderia: number | string | null;
  domicilio_arrendador: string | null;
  domicilio_arrendatario: string | null;
  domicilio_fiador: string | null;
  partes: {
    id: string;
    rol: ContractRole;
    persona_id?: string | null;
    persona_moral_id?: string | null;
    persona_moral?: { id: string; razon_social: string; telefono: string | null; correo: string | null } | null;
    persona: ContractPerson | null;
  }[];
}

export interface ContractTerms {
  fecha_inicio: string;
  fecha_fin: string;
  renta: number;
  deposito: number;
  dia_pago: number;
}

export interface ContractDraftVariables {
  fecha_firma: string | null;
  lugar_firma: string | null;
  costo_lavanderia: number | null;
  domicilio_arrendador: string | null;
  domicilio_arrendatario: string | null;
  domicilio_fiador: string | null;
}
export type ContractDraftTerms = ContractTerms & Partial<ContractDraftVariables>;
export type ContractFormValues = Record<keyof ContractTerms, string> & Partial<Record<keyof ContractDraftVariables, string>>;

export interface ContractApplication {
  id: string;
  folio: string;
  estatus: string;
  fecha_estimada_ocupacion: string | null;
  unidad: (ContractUnit & { precio_renta: string | number | null }) | null;
  participantes: { rol: string; persona: ContractPerson | null }[];
}
