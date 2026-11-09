import { supabase } from "@/lib/supabaseClient";
import type { LandlordSelection, LandlordType } from "./model";

export interface LandlordOption { id: string; nombre: string; rfc: string | null }

export async function searchLandlords(tipo: LandlordType, search: string): Promise<LandlordOption[]> {
  // El texto nunca se incorpora como sintaxis arbitraria del filtro PostgREST.
  const term = search.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim().slice(0, 80);
  if (tipo === "PERSONA_MORAL") {
    let query = supabase.from("personas_morales").select("id, razon_social, rfc").eq("estatus", "ACTIVA");
    if (term) query = query.ilike("razon_social", `%${term}%`);
    const { data, error } = await query.order("razon_social").limit(40);
    if (error) throw error;
    return (data ?? []).map(row => ({ id: row.id, nombre: row.razon_social, rfc: row.rfc }));
  }
  let query = supabase.from("personas").select("id, nombre, apellido_paterno, apellido_materno, rfc");
  for (const token of term.split(/\s+/).filter(Boolean)) query = query.or(`nombre.ilike.%${token}%,apellido_paterno.ilike.%${token}%,apellido_materno.ilike.%${token}%,rfc.ilike.%${token}%`);
  const { data, error } = await query.order("nombre").limit(40);
  if (error) throw error;
  return (data ?? []).map(row => ({ id: row.id, nombre: [row.nombre, row.apellido_paterno, row.apellido_materno].filter(Boolean).join(" "), rfc: row.rfc }));
}

export async function getDefaultLandlord(): Promise<LandlordSelection | null> {
  const { data: setting, error } = await supabase.from("configuracion_sistema").select("valor").eq("clave", "arrendador_persona_moral_id").maybeSingle();
  if (error) throw error;
  if (typeof setting?.valor !== "string" || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(setting.valor)) return null;
  const { data: company, error: companyError } = await supabase.from("personas_morales").select("id").eq("id", setting.valor).eq("estatus", "ACTIVA").maybeSingle();
  if (companyError) throw companyError;
  return company ? { tipo: "PERSONA_MORAL", id: company.id } : null;
}

export async function getLandlordOption(selection: LandlordSelection): Promise<LandlordOption | null> {
  if (selection.tipo === "PERSONA_MORAL") {
    const { data, error } = await supabase.from("personas_morales").select("id, razon_social, rfc").eq("id", selection.id).maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, nombre: data.razon_social, rfc: data.rfc } : null;
  }
  const { data, error } = await supabase.from("personas").select("id, nombre, apellido_paterno, apellido_materno, rfc").eq("id", selection.id).maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, nombre: [data.nombre, data.apellido_paterno, data.apellido_materno].filter(Boolean).join(" "), rfc: data.rfc } : null;
}

export async function replaceDraftLandlord(contractId: string, selection: LandlordSelection) {
  const { error } = await supabase.rpc("cambiar_arrendador_contrato_borrador", {
    p_contrato_id: contractId, p_arrendador_tipo: selection.tipo, p_arrendador_id: selection.id,
  });
  if (error) throw error;
}
