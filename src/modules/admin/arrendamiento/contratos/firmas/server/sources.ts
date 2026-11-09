import type { LandlordCompany } from "@/modules/admin/configuracion/arrendador/types";
import type { TemplateBuilding, TemplateContextSource, TemplateContractSource, TemplatePerson } from "../../plantillas/types";
import { PdfError } from "../../documentos/server/errors";

// Forma exacta de public.firma_fuentes_para_verificar (2C): filas completas, partes ordenadas por id.
export interface SignatureSources {
  contrato: Omit<TemplateContractSource, "partes" | "unidad"> & Record<string, unknown>;
  partes: {
    parte: { id: string; rol: string; persona_id: string | null; persona_moral_id: string | null };
    persona: TemplatePerson | null;
    moral: LandlordCompany | null;
    representantes: { vinculo: { id: string; persona_id: string; caracter: string | null }; persona: TemplatePerson | null }[];
  }[];
  unidad: (NonNullable<TemplateContractSource["unidad"]> & Record<string, unknown>) | null;
  edificio: TemplateBuilding | null;
}

export interface SignerIdentity {
  parte_contrato_id: string;
  rol: string;
  referencia_documento: string;
  entidad_tipo: "PERSONA" | "PERSONA_MORAL";
  entidad_id: string;
  persona_firmante_id: string;
  representante_origen_id: string | null;
}

// Mismos datos que reúne template.service al generar, pero desde las fuentes que PostgreSQL compara.
export function contextSourceFromSources(sources: SignatureSources): TemplateContextSource {
  const partes = sources.partes.map(({ parte, persona }) => ({
    id: parte.id, rol: parte.rol, persona_id: parte.persona_id, persona_moral_id: parte.persona_moral_id, persona,
  }));
  const unidad = sources.unidad ? { ...sources.unidad, edificio: sources.edificio } : null;
  const contract = { ...sources.contrato, partes, unidad } as TemplateContractSource;
  const landlord = sources.partes.find(entry => entry.parte.rol === "ARRENDADOR");
  if (landlord?.parte.persona_moral_id) {
    return { contract, landlord: landlord.moral, partiesModel: true,
      representatives: landlord.representantes.map(({ vinculo, persona }) => ({ id: vinculo.id, caracter: vinculo.caracter, persona })) };
  }
  return { contract, landlord: null, landlordPerson: landlord?.persona ?? null, representatives: [], partiesModel: true };
}

// Correspondencia parte -> lugar del documento -> persona que firma, en el orden de firma_privada.identidades().
export function identitiesFromSources(sources: SignatureSources): SignerIdentity[] {
  return sources.partes.map(({ parte, representantes }) => {
    const base = { parte_contrato_id: parte.id, rol: parte.rol, referencia_documento: parte.rol.toLowerCase() };
    if (parte.persona_moral_id) {
      if (representantes.length !== 1) throw new PdfError(422, "REPRESENTATIVE_INVALID", "La persona moral debe tener exactamente un representante principal para firmar.");
      const [{ vinculo }] = representantes;
      return { ...base, entidad_tipo: "PERSONA_MORAL", entidad_id: parte.persona_moral_id, persona_firmante_id: vinculo.persona_id, representante_origen_id: vinculo.id };
    }
    if (!parte.persona_id) throw new PdfError(422, "PARTY_INVALID", "Una parte del contrato no tiene persona vinculada.");
    return { ...base, entidad_tipo: "PERSONA", entidad_id: parte.persona_id, persona_firmante_id: parte.persona_id, representante_origen_id: null };
  });
}
