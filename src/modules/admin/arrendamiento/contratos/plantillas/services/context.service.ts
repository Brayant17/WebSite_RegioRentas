import { buildLandlordBlocks } from "./landlordBlocks";
import type { ContractTemplateContext, TemplateContextSource, TemplatePerson, TemplatePersonContext } from "../types";
import { dateInWords, formatDate, formatMoney, fullAddress, fullName, moneyInWords, representativeCharacter, templateText } from "../utils/formatters";
import { contractPartiesEnabled, resolveLandlord } from "../../partes/model";

function personContext(person: TemplatePerson | null): TemplatePersonContext {
  return {
    nombre_completo: fullName(person), rfc: templateText(person?.rfc), curp: templateText(person?.curp),
    domicilio: templateText(person?.domicilio_origen), telefono: templateText(person?.telefono), correo: templateText(person?.correo),
  };
}

export function buildContractTemplateContext({ contract, landlord, landlordPerson, representatives, partiesModel = contractPartiesEnabled }: TemplateContextSource): ContractTemplateContext {
  const laundryText = templateText(contract.costo_lavanderia);
  const laundryValue = laundryText ? Number(laundryText) : null;
  if (laundryValue !== null && (!/^\d+(\.\d+)?$/.test(laundryText) || !Number.isFinite(laundryValue) || laundryValue < 0)) {
    throw new Error("El costo de lavandería del contrato debe ser un número no negativo.");
  }
  // Presentación MXN a dos decimales; el valor numérico se guarda sin ese redondeo de presentación.
  const laundryFormatted = laundryValue === null ? "" : "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(laundryValue);
  const tenants = contract.partes.filter(part => part.rol === "ARRENDATARIO");
  const guarantors = contract.partes.filter(part => part.rol === "FIADOR");
  if (tenants.length !== 1) throw new Error("La vista previa V1 requiere exactamente un ARRENDATARIO en las partes del contrato.");
  if (guarantors.length > 1) throw new Error("La vista previa V1 admite como máximo un FIADOR.");
  if (!tenants[0].persona || (guarantors.length === 1 && !guarantors[0].persona)) throw new Error("No se pudieron consultar los datos de una persona vinculada al contrato.");
  const selected = partiesModel ? resolveLandlord(contract.partes) : { tipo: "PERSONA_MORAL", id: contract.arrendador_persona_moral_id };
  let landlordContext: ContractTemplateContext["arrendador"];
  if (selected.tipo === "PERSONA") {
    if (!landlordPerson || landlordPerson.id !== selected.id) throw new Error("No se pudo consultar la persona física arrendadora del contrato.");
    const person = personContext(landlordPerson);
    landlordContext = { tipo: "PERSONA", nombre: person.nombre_completo, razon_social: "", nombre_comercial: "", rfc: person.rfc,
      domicilio: person.domicilio, ciudad: "", estado: "", codigo_postal: "", telefono: person.telefono, correo: person.correo, representante: null };
  } else {
    if (representatives.length !== 1) throw new Error("El arrendador debe tener exactamente un representante principal para generar la vista previa.");
    const representative = representatives[0];
    if (!representative.persona) throw new Error("No se pudieron consultar los datos de la persona representante principal.");
    if (!selected.id || landlord?.id !== selected.id) throw new Error("La persona moral consultada no corresponde al arrendador del contrato.");
    landlordContext = {
      tipo: "PERSONA_MORAL", nombre: templateText(landlord.razon_social),
      razon_social: templateText(landlord.razon_social), nombre_comercial: templateText(landlord.nombre_comercial),
      rfc: templateText(landlord.rfc), domicilio: templateText(landlord.domicilio), ciudad: templateText(landlord.ciudad),
      estado: templateText(landlord.estado), codigo_postal: templateText(landlord.codigo_postal),
      telefono: templateText(landlord.telefono), correo: templateText(landlord.correo),
      representante: { nombre_completo: fullName(representative.persona), caracter: representativeCharacter(representative.caracter),
        rfc: templateText(representative.persona.rfc), curp: templateText(representative.persona.curp),
        telefono: templateText(representative.persona.telefono), correo: templateText(representative.persona.correo) },
    };
  }
  if (landlordContext.tipo === "PERSONA_MORAL") landlordContext.bloques = buildLandlordBlocks(landlordContext);
  if (!contract.unidad) throw new Error("No se pudo consultar la unidad del contrato.");
  const unit = contract.unidad;
  const building = unit.edificio;
  return {
    valores_contractuales: { costo_lavanderia: laundryValue },
    contrato: {
      folio: templateText(contract.folio),
      fecha_inicio: formatDate(contract.fecha_inicio), fecha_inicio_letra: dateInWords(contract.fecha_inicio),
      fecha_fin: formatDate(contract.fecha_fin), fecha_fin_letra: dateInWords(contract.fecha_fin),
      costo_lavanderia: laundryFormatted,
      domicilio_arrendador: templateText(contract.domicilio_arrendador),
      domicilio_arrendatario: templateText(contract.domicilio_arrendatario),
      domicilio_fiador: templateText(contract.domicilio_fiador),
      renta: formatMoney(contract.renta), renta_letra: moneyInWords(contract.renta),
      deposito: formatMoney(contract.deposito), deposito_letra: moneyInWords(contract.deposito),
      dia_pago: templateText(contract.dia_pago),
      fecha_firma: formatDate(contract.fecha_firma), fecha_firma_letra: dateInWords(contract.fecha_firma),
      lugar_firma: templateText(contract.lugar_firma),
    },
    arrendador: landlordContext,
    arrendatario: personContext(tenants[0].persona),
    fiador: personContext(guarantors[0]?.persona ?? null),
    inmueble: {
      nombre: templateText(building?.nombre), direccion: templateText(building?.direccion),
      ciudad: templateText(building?.ciudad), estado: templateText(building?.estado),
      codigo_postal: templateText(building?.codigo_postal), direccion_completa: fullAddress(building),
    },
    unidad: {
      nombre: templateText(unit.nombre), numero: templateText(unit.numero), tipo: templateText(unit.tipo),
      piso: templateText(unit.piso), ubicacion: templateText(unit.ubicacion),
    },
  };
}
