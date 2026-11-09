import { supabase } from "@/lib/supabaseClient";
import { getLandlordCompany, getLandlordSetting } from "@/modules/admin/configuracion/arrendador/repositories/arrendador.repository";
import { getTemplateRepresentatives } from "../../plantillas/repositories/template.repository";
import type { SignatureProcess } from "../types";

// Solo lectura con la sesión del navegador: la política RLS limita procesos y firmantes a administradores.
const processSelect = `id, contrato_id, documento_origen_id, estado, iniciado_at, cancelado_at, motivo_cancelacion,
  documento:documentos_contrato!documento_origen_id(numero_version, nombre_archivo),
  firmantes:firmantes_proceso(id, rol, nombre_entidad, caracter, estado, firmado_at)`;

export async function getLatestSignatureProcess(contractId: string): Promise<SignatureProcess | null> {
  const { data, error } = await supabase.from("procesos_firma").select(processSelect)
    .eq("contrato_id", contractId).order("iniciado_at", { ascending: false }).limit(1).maybeSingle<SignatureProcess>();
  if (error) throw error;
  return data;
}

export interface ContractRepresentation { role: string; companyId: string; company: string; isConfiguredLandlord: boolean; representatives: { caracter: string | null; persona: { nombre: string | null; apellido_paterno: string | null; apellido_materno: string | null } | null }[] }

// Solo lectura: lo que quedará congelado al iniciar, para que el administrador lo revise antes.
export async function getContractRepresentation(contractId: string): Promise<ContractRepresentation[]> {
  const { data, error } = await supabase.from("partes_contrato").select("rol, persona_moral_id").eq("contrato_id", contractId).not("persona_moral_id", "is", null)
    .returns<{ rol: string; persona_moral_id: string }[]>();
  if (error) throw error;
  if (!data?.length) return [];
  const configured = await getLandlordSetting();
  return Promise.all(data.map(async part => ({
    role: part.rol, companyId: part.persona_moral_id, isConfiguredLandlord: configured === part.persona_moral_id,
    company: (await getLandlordCompany(part.persona_moral_id))?.razon_social ?? "",
    representatives: await getTemplateRepresentatives(part.persona_moral_id),
  })));
}
