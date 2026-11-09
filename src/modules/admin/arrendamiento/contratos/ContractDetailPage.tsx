import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataItem } from "../components/DataItem";
import ContractForm from "./components/ContractForm";
import { ContractQueryError, contractPath, contractsPath, dateLabel, money, personName } from "./components/ContractShared";
import { useContract, useContractMutation } from "./hooks/useContracts";
import ContractDocuments from "./documentos/components/ContractDocuments";
import { contractPartiesEnabled } from "./partes/model";
import { DraftLandlordEditor } from "./partes/DraftLandlordEditor";
import { SignatureProcessPanel } from "./firmas/components/SignatureProcessPanel";

export default function ContractDetailPage({ contractId }: { contractId: string }) {
  const { data: contract, loading, error, reload } = useContract(contractId);
  const mutation = useContractMutation();
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState(false);
  return <div className="space-y-6">
    <Button variant="outline" asChild><a href={contractsPath}>Volver a contratos</a></Button>
    {success && <p role="status" className="text-sm">Los cambios del contrato se guardaron correctamente.</p>}
    {loading ? <p role="status">Cargando contrato…</p> : error ? <ContractQueryError message={error} onRetry={reload} /> : !contract ?
      <p>No se encontró el contrato o no está disponible para tu cuenta.</p> : <>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">Contrato {contract.folio}</h1>
          <Badge variant="outline">{contract.estado.replaceAll("_", " ")}</Badge>
        </div>
        {contract.estado === "BORRADOR" && <Button variant="outline" asChild>
          <a href={`${contractPath(contract.id)}/vista-previa`}>Vista previa del contrato</a>
        </Button>}
        <div className="grid gap-5 rounded-lg border p-5 sm:grid-cols-2">
          <DataItem label="Unidad" value={contract.unidad?.nombre ?? "Sin dato"} />
          <DataItem label="Edificio" value={contract.unidad?.edificio?.nombre ?? "Sin dato"} />
          <DataItem label="Fecha de inicio" value={dateLabel(contract.fecha_inicio)} />
          <DataItem label="Fecha de fin" value={dateLabel(contract.fecha_fin)} />
          <DataItem label="Renta mensual" value={money(contract.renta)} />
          <DataItem label="Depósito" value={money(contract.deposito)} />
          <DataItem label="Costo de lavandería (MXN)" value={money(contract.costo_lavanderia)} />
          <DataItem label="Domicilio contractual del arrendador" value={contract.domicilio_arrendador ?? "Sin dato"} />
          <DataItem label="Domicilio contractual del arrendatario" value={contract.domicilio_arrendatario ?? "Sin dato"} />
          <DataItem label="Domicilio contractual del fiador" value={contract.domicilio_fiador ?? "Sin dato"} />
          <DataItem label="Lugar de firma" value={contract.lugar_firma ?? "Sin dato"} />
          <DataItem label="Fecha de firma" value={dateLabel(contract.fecha_firma)} />
          <DataItem label="Día de pago" value={contract.dia_pago === null ? "Sin dato" : String(contract.dia_pago)} />
        </div>
        {contract.estado === "BORRADOR" && (editing ? <section className="space-y-4 rounded-lg border p-5">
          <h2 className="text-lg font-semibold">Editar condiciones del borrador</h2>
          <ContractForm key={contract.id} editDraftVariables initialValues={{ fecha_inicio: contract.fecha_inicio ?? "", fecha_fin: contract.fecha_fin ?? "",
            renta: String(contract.renta ?? ""), deposito: String(contract.deposito ?? ""), dia_pago: String(contract.dia_pago ?? ""),
            costo_lavanderia: String(contract.costo_lavanderia ?? ""), domicilio_arrendador: contract.domicilio_arrendador ?? "",
            domicilio_arrendatario: contract.domicilio_arrendatario ?? "", domicilio_fiador: contract.domicilio_fiador ?? "",
            fecha_firma: contract.fecha_firma ?? "", lugar_firma: contract.lugar_firma ?? "" }}
            saving={mutation.saving} error={mutation.error} submitLabel="Guardar cambios" onCancel={() => setEditing(false)}
            onSubmit={async values => {
              const updated = await mutation.update(contract.id, values);
              if (updated) { setEditing(false); setSuccess(true); reload(); }
            }} />
          {mutation.error && <Button variant="outline" disabled={mutation.saving} onClick={() => { setEditing(false); reload(); }}>Actualizar detalle</Button>}
        </section> : <Button onClick={() => { setEditing(true); setSuccess(false); }}>Editar borrador</Button>)}
        <SignatureProcessPanel contractId={contract.id} onChanged={reload} />
        <ContractDocuments contractId={contract.id} contractStatus={contract.estado} onSignatureStarted={reload} />
        {contractPartiesEnabled && contract.estado === "BORRADOR" && <DraftLandlordEditor contractId={contract.id} parts={contract.partes} onSaved={() => { setSuccess(true); reload(); }} />}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Partes del contrato</h2>
          {!contract.partes.length && <p className="text-sm text-muted-foreground">No hay partes disponibles para este contrato.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {contract.partes.map(part => <div key={part.id} className="space-y-3 rounded-lg border p-5">
              <Badge variant="secondary">{part.rol.replaceAll("_", " ")}</Badge>
              <h3 className="font-semibold">{part.persona_moral?.razon_social ?? personName(part.persona)}</h3>
              {part.persona_moral && <p className="text-sm text-muted-foreground">Persona moral</p>}
              <DataItem label="Teléfono" value={part.persona_moral?.telefono ?? part.persona?.telefono ?? "Sin dato"} />
              <DataItem label="Correo" value={part.persona_moral?.correo ?? part.persona?.correo ?? "Sin dato"} />
            </div>)}
          </div>
        </section>
      </>}
  </div>;
}
