import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContractQueryError } from "../../components/ContractShared";
import { useContractDocuments } from "../hooks/useContractDocuments";
import { documentGeneratedAt, documentPath } from "./DocumentShared";
import { PdfActions } from "./PdfActions";

export default function ContractDocuments({ contractId }: { contractId: string }) {
  const { data, loading, error, reload } = useContractDocuments(contractId);
  return <section className="space-y-4" aria-labelledby="contract-documents-title">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="contract-documents-title" className="text-lg font-semibold">Documentos del contrato</h2>
      <Button variant="outline" size="sm" disabled={loading} onClick={reload}>Actualizar documentos</Button>
    </div>
    {loading ? <p role="status">Cargando documentos…</p> : error ? <ContractQueryError message={error} onRetry={reload} /> : !data?.length ?
      <p className="text-sm text-muted-foreground">Todavía no hay documentos generados para este contrato.</p> : <div className="rounded-lg border p-3">
        <Table><TableHeader><TableRow>
          <TableHead>Revisión</TableHead><TableHead>Tipo</TableHead><TableHead>Estado</TableHead>
          <TableHead>Generado</TableHead><TableHead>Nombre de archivo</TableHead><TableHead>Acciones</TableHead>
        </TableRow></TableHeader><TableBody>{data.map(document => <TableRow key={document.id}>
          <TableCell>v{document.numero_version}</TableCell><TableCell>{document.tipo}</TableCell><TableCell>{document.estado}</TableCell>
          <TableCell>{documentGeneratedAt(document.generated_at)}</TableCell><TableCell>{document.nombre_archivo}</TableCell>
          <TableCell className="space-y-2"><Button asChild size="sm" variant="outline"><a href={documentPath(contractId, document.id)}>Ver documento</a></Button><PdfActions contractId={contractId} documentId={document.id} storagePath={document.storage_path} /></TableCell>
        </TableRow>)}</TableBody></Table>
      </div>}
  </section>;
}
