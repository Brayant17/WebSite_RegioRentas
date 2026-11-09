import { Button } from "@/components/ui/button";
import { DataItem } from "../../components/DataItem";
import { ContractQueryError, contractPath } from "../components/ContractShared";
import { useHistoricalDocument } from "./hooks/useContractDocuments";
import { documentGeneratedAt } from "./components/DocumentShared";
import { PdfActions } from "./components/PdfActions";

export default function HistoricalDocumentPage({ contractId, documentId }: { contractId: string; documentId: string }) {
  const { data, loading, error, reload } = useHistoricalDocument(contractId, documentId);
  return <div className="space-y-5">
    <Button variant="outline" asChild><a href={contractPath(contractId)}>Volver al contrato</a></Button>
    <h1 className="text-xl font-semibold">Documento histórico{data ? ` · v${data.document.numero_version}` : ""}</h1>
    {loading ? <p role="status">Cargando documento histórico…</p> : error ? <ContractQueryError message={error} onRetry={reload} /> : data && <>
      <div className="grid gap-4 rounded-lg border p-5 sm:grid-cols-2">
        <DataItem label="Revisión del documento" value={`v${data.document.numero_version}`} />
        <DataItem label="Generado" value={documentGeneratedAt(data.document.generated_at)} />
        <DataItem label="Tipo" value={data.document.tipo} /><DataItem label="Estado" value={data.document.estado} />
        <DataItem label="Nombre de archivo reservado" value={data.document.nombre_archivo} wide />
      </div>
      <p className="text-sm text-muted-foreground">Contenido guardado al generar esta revisión. Los cambios posteriores del contrato o de la plantilla no modifican este documento.</p>
      <PdfActions key={documentId} contractId={contractId} documentId={documentId} storagePath={data.document.storage_path} />
      <iframe title={`Documento histórico v${data.document.numero_version}`} sandbox="" referrerPolicy="no-referrer"
        srcDoc={data.iframeDocument} className="h-[75vh] min-h-[480px] w-full rounded-lg border bg-white" />
    </>}
  </div>;
}
