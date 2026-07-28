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