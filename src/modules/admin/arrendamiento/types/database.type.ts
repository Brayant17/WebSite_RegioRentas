// src/types/database.ts

export interface Persona {
  nombre: string;
  apellido_paterno: string;
  telefono: string | null;
  correo: string;
}

export interface Edificio {
  nombre: string;
}

export interface Unidad {
  nombre: string;
  tipo: string;
  edificio: Edificio;
}

export interface ParticipanteSolicitud {
  personas: Persona;
}

export interface Solicitud {
  id: string;
  folio: string;
  unidades: Unidad;
  participantes_solicitud: ParticipanteSolicitud[];
  estatus: string;
  created_at: string;
}

export type ApplicationDetail = {
    solicitud_id: string;
    folio: string;
    fecha_estimada_ocupacion: string | null;
    estatus: string;
    created_at: string;
    solicitante_nombre: string | null;
    solicitante_apellido_paterno: string | null;
    solicitante_apellido_materno: string | null;
    solicitante_telefono: string | null;
    solicitante_correo: string | null;
    solicitante_curp: string | null;
    solicitante_rfc: string | null;
    solicitante_sexo: string | null;
    solicitante_estado_civil: string | null;
    solicitante_domicilio_origen: string | null;
    solicitante_rol: string | null;
    situacion_laboral: string | null;
    empresa: string | null;
    puesto: string | null;
    ingreso_mensual: number | string | null;
    jefe_inmediato: string | null;
    telefono_empresa: string | null;
    antiguedad: string | null;
    fiador_nombre: string | null;
    fiador_apellido_paterno: string | null;
    fiador_apellido_materno: string | null;
    fiador_telefono: string | null;
    fiador_correo: string | null;
    fiador_parentesco: string | null;
    referencias_personales: ReferenciaPersonal[] | null;
    documentos_personales: DocumentoPersonal[] | null;
};

export type ReferenciaPersonal = {
    nombre: string;
    parentesco: string;
    telefono: string;
};

// Ajusta esta forma según lo que realmente regrese tu bucket de Supabase Storage.
export type DocumentoPersonal =
    {
        url: string;
        nombre_archivo: string;
        tipo_documento: string;
        estatus: string;
    };

