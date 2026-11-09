import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataItem } from "../components/DataItem";
import ContractForm from "./components/ContractForm";
import { ContractQueryError, contractPath, personName } from "./components/ContractShared";
import { useContractCreation, useContractMutation, useContractRecovery } from "./hooks/useContracts";
import { parseAmount } from "./services/contratos.service";
import { contractPartiesEnabled, type LandlordSelection } from "./partes/model";
import { LandlordSelector } from "./partes/LandlordSelector";

export default function CreateContractPage({ solicitudId }: { solicitudId: string }) {
  const { data, loading, error, reload } = useContractCreation(solicitudId);
  const mutation = useContractMutation();
  const recovery = useContractRecovery(solicitudId);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [landlord, setLandlord] = useState<LandlordSelection | null>(null);
  async function checkExisting() {
    const existing = await recovery.check();
    if (existing) { setRecovered(true); setCreatedId(existing.id); reload(); }
  }
  if (createdId) return <div className="space-y-4">
    <p role="status">{recovered ? "La solicitud ya tiene un contrato. Puedes consultarlo a continuación." : "Contrato creado correctamente en estado BORRADOR."}</p>
    <Button asChild><a href={contractPath(createdId)}>Ver contrato</a></Button>
  </div>;
  if (loading) return <p role="status">Cargando solicitud y contrato…</p>;
  if (error) return <ContractQueryError message={error} onRetry={reload} />;
  if (!data?.application) return <p>No se encontró la solicitud.</p>;
  if (data.contract) return <div className="space-y-4">
    <p>Esta solicitud ya tiene el contrato {data.contract.folio}.</p>
    <Button asChild><a href={contractPath(data.contract.id)}>Ver contrato</a></Button>
  </div>;
  const application = data.application;
  if (application.estatus !== "aprobada") return <p>Solo se pueden generar contratos desde solicitudes aprobadas.</p>;
  const rawRent = application.unidad?.precio_renta;
  const rent = parseAmount(rawRent);
  const rentWarning = rawRent !== null && rawRent !== undefined && (rent === null || rent <= 0);
  return <div className="max-w-3xl space-y-6">
    <div className="grid gap-4 rounded-lg border p-5 sm:grid-cols-2">
      <DataItem label="Solicitud" value={application.folio} />
      <DataItem label="Unidad" value={application.unidad?.nombre ?? "Sin dato"} />
      <DataItem label="Edificio" value={application.unidad?.edificio?.nombre ?? "Sin dato"} />
      {application.participantes.map((participant, index) => <DataItem key={`${participant.rol}-${index}`}
        label={participant.rol === "solicitante" ? "Arrendatario" : participant.rol.replaceAll("_", " ")}
        value={personName(participant.persona)} />)}
    </div>
    <p className="text-sm text-muted-foreground">El contrato se creará como borrador. El folio, la unidad y los participantes de la solicitud se asignan automáticamente.</p>
    {rentWarning && <p role="status" className="text-sm text-amber-700">No se pudo precargar la renta registrada («{String(rawRent)}») como un importe válido. Ingresa la renta manualmente.</p>}
    <ContractForm initialValues={{ fecha_inicio: application.fecha_estimada_ocupacion ?? "", fecha_fin: "", renta: rent !== null && rent > 0 ? String(rent) : "", deposito: "", dia_pago: "" }}
      saving={mutation.saving || recovery.checking} error={mutation.error} submitLabel="Crear contrato BORRADOR"
      disabled={contractPartiesEnabled && !landlord}
      onSubmit={async values => {
        const id = await mutation.create(solicitudId, values, landlord ?? undefined);
        if (id) { setCreatedId(id); reload(); }
        else await checkExisting();
      }}>
      {contractPartiesEnabled && <LandlordSelector value={landlord} onChange={setLandlord} useDefault disabled={mutation.saving || recovery.checking} />}
    </ContractForm>
    {mutation.error && <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Si la solicitud ya tiene contrato o se interrumpió la conexión, consulta antes de volver a crear.</p>
      <Button variant="outline" disabled={recovery.checking || mutation.saving} onClick={checkExisting}>
        {recovery.checking ? "Consultando…" : "Comprobar contrato existente"}
      </Button>
      {recovery.error && <p role="status" className="text-sm">{recovery.error}</p>}
    </div>}
  </div>;
}
