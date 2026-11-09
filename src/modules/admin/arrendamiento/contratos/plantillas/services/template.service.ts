import { getLandlordCompany } from "@/modules/admin/configuracion/arrendador/repositories/arrendador.repository";
import { getDraftTemplateVersion, getDraftTemplateVersions, getTemplateContract, getTemplateRepresentatives } from "../repositories/template.repository";
import { buildContractTemplateContext } from "./context.service";
import { renderContractTemplate } from "../renderer";
import { importantEmptyFields } from "../utils/contextWarnings";
import { contractPartiesEnabled, resolveLandlord } from "../../partes/model";

export const listDraftTemplateVersions = getDraftTemplateVersions;

export async function loadContractTemplateContext(contractId: string, partiesModel = contractPartiesEnabled) {
  const contract = await getTemplateContract(contractId, partiesModel);
  if (!contract) throw new Error("No se encontró el contrato o no tienes permiso para consultarlo.");
  if (contract.estado !== "BORRADOR") throw new Error("Esta vista previa está disponible únicamente para contratos BORRADOR.");
  const selected = partiesModel ? resolveLandlord(contract.partes) : { tipo: "PERSONA_MORAL", id: contract.arrendador_persona_moral_id };
  if (selected.tipo === "PERSONA") {
    const person = contract.partes.find(part => part.rol === "ARRENDADOR")?.persona;
    return buildContractTemplateContext({ contract, landlord: null, landlordPerson: person, representatives: [], partiesModel });
  }
  if (!selected.id) throw new Error("El contrato no tiene una persona moral arrendadora vinculada.");
  const [landlord, representatives] = await Promise.all([
    getLandlordCompany(selected.id),
    getTemplateRepresentatives(selected.id),
  ]);
  if (!landlord) throw new Error("No se encontró la persona moral arrendadora del contrato o no tienes permiso para consultarla.");
  return buildContractTemplateContext({ contract, landlord, representatives, partiesModel });
}

export async function loadContractTemplatePreview(contractId: string, versionId: string) {
  const [context, version] = await Promise.all([loadContractTemplateContext(contractId), getDraftTemplateVersion(versionId)]);
  if (!version || !version.plantilla) throw new Error("La versión BORRADOR o su plantilla ya no están disponibles. Vuelve a cargar las opciones.");
  if (!version.contenido?.trim()) throw new Error("La versión seleccionada no tiene contenido HTML.");
  const compatibilityWarnings = context.arrendador.tipo === "PERSONA" ? ["El arrendador es persona física. La redacción de esta plantilla puede estar orientada a personas morales; los campos de razón social y representante permanecerán vacíos. Revisa el contenido antes de generar. La redacción para persona física se abordará en la plantilla V2."] : [];
  return { ...renderContractTemplate(version.contenido, context), context, version, emptyFields: importantEmptyFields(context), compatibilityWarnings };
}
