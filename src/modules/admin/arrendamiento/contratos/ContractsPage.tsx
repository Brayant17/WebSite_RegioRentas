import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useContracts } from "./hooks/useContracts";
import { ContractQueryError, contractPath, dateLabel, money } from "./components/ContractShared";

export default function ContractsPage() {
  const { data, loading, error, reload } = useContracts();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => (data ?? []).filter(contract =>
    [contract.folio, contract.unidad?.nombre, contract.unidad?.edificio?.nombre, contract.estado]
      .some(value => value?.toLocaleLowerCase("es-MX").includes(search.trim().toLocaleLowerCase("es-MX")))), [data, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, totalPages);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-semibold">Contratos</h1><p className="text-sm text-muted-foreground">Genera nuevos contratos desde una solicitud aprobada.</p></div>
      <Button variant="outline" asChild><a href="/admin/arrendamiento/solicitudes">Ver solicitudes</a></Button>
    </div>
    <Input aria-label="Buscar contratos" placeholder="Buscar por folio, unidad, edificio o estado" value={search}
      onChange={event => { setSearch(event.target.value); setPage(1); }} />
    {loading ? <p role="status">Cargando contratos…</p> : error ? <ContractQueryError message={error} onRetry={reload} /> :
      <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
        <Table><TableHeader><TableRow>
          <TableHead>Folio</TableHead><TableHead>Unidad / edificio</TableHead><TableHead>Estado</TableHead>
          <TableHead>Vigencia</TableHead><TableHead>Renta</TableHead><TableHead>Acciones</TableHead>
        </TableRow></TableHeader><TableBody>
          {filtered.slice((currentPage - 1) * 10, currentPage * 10).map(contract => <TableRow key={contract.id}>
            <TableCell>{contract.folio}</TableCell>
            <TableCell>{contract.unidad?.nombre ?? "Sin unidad disponible"}<div className="text-xs text-muted-foreground">{contract.unidad?.edificio?.nombre}</div></TableCell>
            <TableCell><Badge variant="outline">{contract.estado.replaceAll("_", " ")}</Badge></TableCell>
            <TableCell>{dateLabel(contract.fecha_inicio)} — {dateLabel(contract.fecha_fin)}</TableCell>
            <TableCell>{money(contract.renta)}</TableCell>
            <TableCell><Button variant="outline" size="sm" asChild><a href={contractPath(contract.id)}>Ver contrato</a></Button></TableCell>
          </TableRow>)}
          {!filtered.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
            {data?.length ? "No hay contratos que coincidan con la búsqueda." : "Todavía no hay contratos."}
          </TableCell></TableRow>}
        </TableBody></Table>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} contratos · Página {currentPage} de {totalPages}</span>
          <Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button>
          <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>Siguiente</Button>
        </div>
      </div>}
  </div>;
}
