import { supabase } from "@/lib/supabaseClient";
import type { CompanyFields, LandlordCompany, LandlordRepresentative, RepresentativeCharacter } from "../types";

const companySelect = "id, razon_social, nombre_comercial, rfc, domicilio, ciudad, estado, codigo_postal, telefono, correo, estatus";
const representativeSelect = `id, persona_moral_id, persona_id, caracter, es_principal,
  persona:personas!persona_id(nombre, apellido_paterno, apellido_materno, telefono, correo)`;

export async function getLandlordSetting() {
  const { data, error } = await supabase.from("configuracion_sistema").select("valor")
    .eq("clave", "arrendador_persona_moral_id").maybeSingle<{ valor: string | null }>();
  if (error) throw error;
  return data?.valor ?? null;
}

export async function getLandlordCompany(id: string) {
  const { data, error } = await supabase.from("personas_morales").select(companySelect)
    .eq("id", id).maybeSingle<LandlordCompany>();
  if (error) throw error;
  return data;
}

export async function getPrincipalRepresentative(companyId: string) {
  // maybeSingle también detecta la inconsistencia de varios representantes principales.
  const { data, error } = await supabase.from("representantes_persona_moral").select(representativeSelect)
    .eq("persona_moral_id", companyId).eq("es_principal", true).maybeSingle<LandlordRepresentative>();
  if (error) throw error;
  return data;
}

export async function updateLandlordCompany(id: string, fields: CompanyFields) {
  const { data, error } = await supabase.from("personas_morales").update({
    razon_social: fields.razon_social,
    nombre_comercial: fields.nombre_comercial,
    rfc: fields.rfc,
    domicilio: fields.domicilio,
    ciudad: fields.ciudad,
    estado: fields.estado,
    codigo_postal: fields.codigo_postal,
    telefono: fields.telefono,
    correo: fields.correo,
  }).eq("id", id).select(companySelect).maybeSingle<LandlordCompany>();
  if (error) throw error;
  if (!data) throw new Error("La persona moral no está disponible o no tienes permiso para modificarla.");
  return data;
}

export async function updateRepresentativeCharacter(representative: LandlordRepresentative, caracter: RepresentativeCharacter) {
  const { data, error } = await supabase.from("representantes_persona_moral").update({ caracter })
    .eq("id", representative.id).eq("persona_moral_id", representative.persona_moral_id)
    .eq("persona_id", representative.persona_id).eq("es_principal", true)
    .select(representativeSelect).maybeSingle<LandlordRepresentative>();
  if (error) throw error;
  if (!data) throw new Error("El representante principal cambió o no tienes permiso para modificar su carácter. Vuelve a cargar los datos.");
  return data;
}
