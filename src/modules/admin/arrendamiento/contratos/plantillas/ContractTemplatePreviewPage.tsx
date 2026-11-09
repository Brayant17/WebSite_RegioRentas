import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContractQueryError, contractPath } from "../components/ContractShared";
import { useContractTemplatePreview } from "./hooks/useContractTemplatePreview";
import GenerateDocumentButton from "../documentos/components/GenerateDocumentButton";

export default function ContractTemplatePreviewPage({ contractId }: { contractId: string }) {
  const state = useContractTemplatePreview(contractId);
  const selected = state.versions.find(version => version.id === state.versionId);
  return <div className="space-y-5">
    <Button variant="outline" asChild><a href={contractPath(contractId)}>Volver al contrato</a></Button>
    <header className="space-y-1">
      <h1 className="text-xl font-semibold">Vista previa del contrato</h1>
      <p className="text-sm text-muted-foreground">Consulta los datos actuales y genera una revisión histórica cuando estés listo.</p>
    </header>
    {state.loadingVersions ? <p role="status">Cargando versiones de plantilla…</p> : state.versionsError ?
      <ContractQueryError message={state.versionsError} onRetry={state.reload} /> : !state.versions.length ?
      <div className="space-y-3 rounded-lg border p-5"><p>No hay versiones BORRADOR disponibles para previsualizar.</p><Button variant="outline" onClick={state.reload}>Volver a consultar</Button></div> : <>
        <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="template-version">Plantilla y versión</Label>
            <Select value={state.versionId} onValueChange={state.selectVersion}>
              <SelectTrigger id="template-version" className="w-full"><SelectValue placeholder="Selecciona una plantilla y versión" /></SelectTrigger>
              <SelectContent>{state.versions.map(version => <SelectItem key={version.id} value={version.id}>
                {version.plantilla?.nombre ?? "Plantilla no disponible"} · Versión {version.numero_version} · {version.estado}
              </SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button variant="outline" disabled={!state.versionId || state.loadingPreview} onClick={state.refreshPreview}>Actualizar vista previa</Button>
          <Button variant="ghost" onClick={state.reload}>Recargar versiones</Button>
        </div>
        {selected?.plantilla?.descripcion && <p className="text-sm text-muted-foreground">{selected.plantilla.descripcion}</p>}
        {!state.versionId && <p>Selecciona la versión que quieres utilizar.</p>}
        {state.loadingPreview && <p role="status">Preparando contexto y vista previa…</p>}
        {state.previewError && <ContractQueryError message={state.previewError} onRetry={state.refreshPreview} />}
        <GenerateDocumentButton contractId={contractId} versionId={state.versionId}
          versionLabel={selected ? `${selected.plantilla?.nombre ?? "Plantilla"} · Versión ${selected.numero_version}` : ""}
          disabled={!state.preview || state.loadingPreview || state.preview.versionId !== state.versionId || state.preview.unresolvedVariables.length > 0}
          emptyFields={state.preview?.emptyFields ?? []} />
        {state.preview && <>
          {state.preview.compatibilityWarnings.map(warning => <p key={warning} role="alert" className="rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">{warning}</p>)}
          {state.preview.emptyFields.length > 0 && <div className="space-y-2 rounded-lg border border-amber-400 bg-amber-50 p-4 text-amber-950" role="status">
            <p className="font-medium">Campos importantes sin datos</p>
            <ul className="list-inside list-disc text-sm">{state.preview.emptyFields.map(field => <li key={field.variable}>{field.label} (<code>{field.variable}</code>)</li>)}</ul>
            <p className="text-sm">Estos campos vacíos no impiden generar el documento.</p>
          </div>}
          {state.preview.unresolvedVariables.length > 0 && <div role="alert" className="space-y-2 rounded-lg border border-amber-400 bg-amber-50 p-4 text-amber-950">
            <p className="font-medium">La plantilla contiene variables no reconocidas:</p>
            <ul className="list-inside list-disc text-sm">{state.preview.unresolvedVariables.map(variable => <li key={variable}><code>{`{{${variable}}}`}</code></li>)}</ul>
            <p className="text-sm">La vista previa está incompleta. Revisa estas variables en la plantilla.</p>
          </div>}
          <iframe title="Contenido de la vista previa del contrato" sandbox="" referrerPolicy="no-referrer"
            srcDoc={state.preview.document} className="h-[75vh] min-h-[480px] w-full rounded-lg border bg-white" />
        </>}
      </>}
  </div>;
}
