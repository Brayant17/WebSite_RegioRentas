export interface BloquesArrendadorResueltos {
  revision: string;
  tipo: "PERSONA" | "PERSONA_MORAL";
  comparecencia: string;
  antecedentes_identidad: string;
  firma: string;
}

import type { Contract, ContractPerson, ContractDetail } from "../types";
import type { LandlordCompany } from "@/modules/admin/configuracion/arrendador/types";

export interface TemplatePersonContext {
  nombre_completo: string;
  rfc: string;
  curp: string;
  domicilio: string;
  telefono: string;
  correo: string;
}

// Datos JSON serializables: presentación y valores numéricos separados.
export interface ContractTemplateContext {
  // Ausente en snapshots anteriores a 2B.2; no es un catálogo de placeholders.
  valores_contractuales?: { costo_lavanderia: number | null };
  contrato: {
    folio: string;
    fecha_inicio: string;
    fecha_inicio_letra: string;
    fecha_fin: string;
    fecha_fin_letra: string;
    // Opcionales solo por compatibilidad con snapshots históricos. Siempre presentes al generar.
    costo_lavanderia?: string;
    domicilio_arrendador?: string;
    domicilio_arrendatario?: string;
    domicilio_fiador?: string;
    renta: string;
    renta_letra: string;
    deposito: string;
    deposito_letra: string;
    dia_pago: string;
    fecha_firma: string;
    fecha_firma_letra: string;
    lugar_firma: string;
  };
  arrendador: {
    // Ausente en históricos y en PERSONA sin redacción aprobada.
    bloques?: BloquesArrendadorResueltos;
    tipo?: "PERSONA" | "PERSONA_MORAL";
    nombre?: string;
    razon_social: string;
    nombre_comercial: string;
    rfc: string;
    domicilio: string;
    ciudad: string;
    estado: string;
    codigo_postal: string;
    telefono: string;
    correo: string;
    representante: {
      nombre_completo: string;
      caracter: string;
      rfc: string;
      curp: string;
      telefono: string;
      correo: string;
    } | null;
  };
  arrendatario: TemplatePersonContext;
  fiador: TemplatePersonContext;
  inmueble: {
    nombre: string;
    direccion: string;
    ciudad: string;
    estado: string;
    codigo_postal: string;
    direccion_completa: string;
  };
  unidad: { nombre: string; numero: string; tipo: string; piso: string; ubicacion: string };
}

export interface TemplatePerson extends ContractPerson {
  rfc: string | null;
  curp: string | null;
  domicilio_origen: string | null;
}

export interface TemplateBuilding {
  nombre: string | null;
  direccion: string | null;
  ciudad: string | null;
  estado: string | null;
  codigo_postal: string | null;
}

export interface TemplateContractSource extends Pick<Contract,
  "id" | "estado" | "arrendador_persona_moral_id" | "folio" | "fecha_inicio" | "fecha_fin" | "renta" | "deposito" | "dia_pago" | "fecha_firma" | "lugar_firma">, Pick<ContractDetail,
  "costo_lavanderia" | "domicilio_arrendador" | "domicilio_arrendatario" | "domicilio_fiador"> {
  partes: { id: string; rol: string; persona_id?: string | null; persona_moral_id?: string | null; persona: TemplatePerson | null }[];
  unidad: {
    nombre: string | null;
    numero: string | number | null;
    tipo: string | null;
    piso: string | number | null;
    ubicacion: string | null;
    edificio: TemplateBuilding | null;
  } | null;
}

export interface TemplateRepresentative {
  id: string;
  caracter: string | null;
  persona: TemplatePerson | null;
}

export interface TemplateContextSource {
  contract: TemplateContractSource;
  landlord: LandlordCompany | null;
  landlordPerson?: TemplatePerson | null;
  partiesModel?: boolean;
  representatives: TemplateRepresentative[];
}

export interface TemplateVersionOption {
  id: string;
  plantilla_id: string;
  numero_version: number;
  estado: string;
  plantilla: { id: string; nombre: string; descripcion: string | null; estado: string } | null;
}

export interface TemplateVersion extends TemplateVersionOption {
  contenido: string | null;
}

export interface TemplateRenderResult {
  html: string;
  unresolvedVariables: string[];
}
