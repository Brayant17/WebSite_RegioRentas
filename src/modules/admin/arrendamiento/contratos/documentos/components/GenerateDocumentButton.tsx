import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDocumentGeneration } from "../hooks/useDocumentGeneration";
import { documentPath } from "./DocumentShared";
import { contractPath } from "../../components/ContractShared";
import type { EmptyFieldWarning } from "../../plantillas/utils/contextWarnings";

export default function GenerateDocumentButton({ contractId, versionId, versionLabel, disabled, emptyFields }: {
  contractId: string; versionId: string; versionLabel: string; disabled: boolean; emptyFields: EmptyFieldWarning[];
}) {
  // Captura el ID mostrado al abrir la confirmación; nunca vuelve a elegir una versión.
  const [confirmation, setConfirmation] = useState<{ id: string; label: string } | null>(null);
  const generation = useDocumentGeneration(contractId);
  return <div className="space-y-3">
    <Button disabled={disabled || generation.saving || !versionId} onClick={() => setConfirmation({ id: versionId, label: versionLabel })}>
      {generation.saving ? "Generando documento…" : "Generar documento"}
    </Button>
    {generation.error && <div role="alert" className="space-y-2">
      <p className="text-sm text-destructive">{generation.error}</p>
      <Button variant="outline" asChild><a href={contractPath(contractId)}>Consultar documentos del contrato</a></Button>
    </div>}
    {generation.result && <div className="space-y-2 rounded-lg border p-4">
      <p role="status">Documento v{generation.result.document.numero_version} generado correctamente.</p>
      {generation.result.emptyFields.length > 0 && <p className="text-sm text-muted-foreground">Se generó con estos campos vacíos: {generation.result.emptyFields.map(field => field.label).join(", ")}.</p>}
      <Button asChild variant="outline"><a href={documentPath(contractId, generation.result.document.id)}>Ver documento generado</a></Button>
    </div>}
    <Dialog open={Boolean(confirmation)} onOpenChange={open => { if (!open && !generation.saving) setConfirmation(null); }}>
      <DialogContent showCloseButton={!generation.saving}>
        <DialogHeader>
          <DialogTitle>Generar nueva revisión histórica</DialogTitle>
          <DialogDescription>Se creará una nueva versión histórica del documento usando los datos actuales del contrato. Esta versión no cambiará aunque posteriormente se modifiquen los datos.</DialogDescription>
        </DialogHeader>
        <p className="text-sm">Plantilla seleccionada: {confirmation?.label}</p>
        {emptyFields.length > 0 && <p className="text-sm text-amber-700">Hay campos importantes vacíos: {emptyFields.map(field => field.label).join(", ")}. Puedes generar esta revisión de todos modos.</p>}
        {generation.error && <p role="alert" className="text-sm text-destructive">{generation.error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={generation.saving} onClick={() => setConfirmation(null)}>Cancelar</Button>
          <Button disabled={generation.saving || !confirmation || disabled} onClick={async () => {
            if (!confirmation) return;
            const result = await generation.generate(confirmation.id);
            if (result) setConfirmation(null);
          }}>{generation.saving ? "Generando…" : "Generar documento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
