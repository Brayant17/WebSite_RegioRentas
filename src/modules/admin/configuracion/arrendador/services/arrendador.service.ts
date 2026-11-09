import { z } from "zod";
import * as repository from "../repositories/arrendador.repository";
import type { CompanyFields, LandlordFormValues, LandlordSettings, RepresentativeCharacter } from "../types";
import { representativeCharacters } from "../types";

export function landlordErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  if (code === "42501" || code === "PGRST301" || code === "PGRST303") return "Tu sesión no tiene autorización. Ingresa nuevamente con una cuenta administradora.";
  if (code === "PGRST116") return "Se encontró más de un registro donde se esperaba uno. Solicita revisar la configuración del representante principal.";
  if (code === "23505") return "Uno de los datos ya está registrado. Revisa la información antes de guardar.";
  if (code === "23514" || code === "23502") return "Los datos no cumplen las restricciones de la base de datos. Revisa los campos capturados.";
  if (error instanceof Error) {
    if (/fetch|network/i.test(error.message)) return "No se pudo confirmar la operación por un problema de conexión. Vuelve a cargar los datos para comprobar su estado.";
    return error.message;
  }
  return "No se pudo completar la operación. Revisa tu conexión y los permisos de tu cuenta, e inténtalo nuevamente.";
}

async function configuredCompanyId() {
  const value = await repository.getLandlordSetting();
  if (!value?.trim()) throw new Error("No hay una persona moral configurada como arrendador. Solicita al responsable del sistema revisar la configuración.");
  const result = z.string().uuid().safeParse(value.trim());
  if (!result.success) throw new Error("El identificador del arrendador configurado no es válido. Solicita revisar la configuración del sistema.");
  return result.data;
}

export async function loadLandlordSettings(): Promise<LandlordSettings> {
  const companyId = await configuredCompanyId();
  const company = await repository.getLandlordCompany(companyId);
  if (!company) throw new Error("La persona moral configurada no existe o no está disponible para tu cuenta.");
  const representative = await repository.getPrincipalRepresentative(companyId);
  return { company, representative };
}

export function normalizeLandlordForm(values: LandlordFormValues, hasRepresentative: boolean): {
  company: CompanyFields; caracter: RepresentativeCharacter | null;
} {
  const optional = (value: string) => value.trim() || null;
  const company: CompanyFields = {
    razon_social: values.razon_social.trim(),
    nombre_comercial: optional(values.nombre_comercial),
    rfc: optional(values.rfc),
    domicilio: optional(values.domicilio),
    ciudad: optional(values.ciudad),
    estado: optional(values.estado),
    codigo_postal: optional(values.codigo_postal),
    telefono: optional(values.telefono),
    correo: optional(values.correo),
  };
  if (!company.razon_social) throw new Error("La razón social es obligatoria.");
  if (company.correo && !z.string().email().safeParse(company.correo).success) throw new Error("Ingresa un correo válido para la persona moral.");
  const caracter = values.caracter.trim();
  if (hasRepresentative && !Object.hasOwn(representativeCharacters, caracter)) throw new Error("Selecciona un carácter válido para el representante principal.");
  return { company, caracter: hasRepresentative ? caracter as RepresentativeCharacter : null };
}

export async function saveLandlordSettings(current: LandlordSettings, values: LandlordFormValues): Promise<LandlordSettings> {
  const fields = normalizeLandlordForm(values, current.representative !== null);
  // Releer la selección evita guardar en una empresa que dejó de ser el arrendador mientras se editaba.
  const companyId = await configuredCompanyId();
  if (companyId !== current.company.id) throw new Error("El arrendador configurado cambió. Vuelve a cargar los datos antes de guardar.");
  const principal = await repository.getPrincipalRepresentative(companyId);
  if (principal?.id !== current.representative?.id || principal?.persona_id !== current.representative?.persona_id) {
    throw new Error("El representante principal cambió. Vuelve a cargar los datos antes de guardar.");
  }
  let company;
  try {
    company = await repository.updateLandlordCompany(companyId, fields.company);
  } catch (error) {
    throw new Error(`No se pudo confirmar el guardado de la persona moral. No se intentó actualizar al representante. ${landlordErrorMessage(error)}`);
  }
  let representative = current.representative;
  if (representative && fields.caracter) {
    try {
      representative = await repository.updateRepresentativeCharacter(representative, fields.caracter);
    } catch (error) {
      // Son dos peticiones independientes: no se promete atomicidad ni se revierte una escritura ajena.
      throw new Error(`Los datos de la persona moral se guardaron, pero no se pudo confirmar el carácter del representante. Puedes reintentar el guardado o volver a cargar los datos. ${landlordErrorMessage(error)}`);
    }
  }
  return { company, representative };
}

export function landlordFormValues({ company, representative }: LandlordSettings): LandlordFormValues {
  return {
    razon_social: company.razon_social ?? "",
    nombre_comercial: company.nombre_comercial ?? "",
    rfc: company.rfc ?? "",
    domicilio: company.domicilio ?? "",
    ciudad: company.ciudad ?? "",
    estado: company.estado ?? "",
    codigo_postal: company.codigo_postal ?? "",
    telefono: company.telefono ?? "",
    correo: company.correo ?? "",
    caracter: representative?.caracter ?? "",
  };
}
