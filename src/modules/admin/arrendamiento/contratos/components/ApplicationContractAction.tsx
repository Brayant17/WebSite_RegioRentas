import { Button } from "@/components/ui/button";
import { useApplicationContract } from "../hooks/useContracts";
import { contractPath, contractsPath } from "./ContractShared";

export default function ApplicationContractAction({ solicitudId, status }: { solicitudId: string; status: string }) {
  const { data, loading, error, reload } = useApplicationContract(solicitudId);
  if (loading) return <span role="status" className="text-xs text-muted-foreground">Consultando contrato…</span>;
  if (error) return <div className="max-w-64 space-y-1">
    <p role="alert" className="text-xs text-destructive">{error}</p>
    <Button size="sm" variant="outline" onClick={reload}>Reintentar consulta</Button>
  </div>;
  if (data) return <Button size="sm" variant="outline" asChild><a href={contractPath(data.id)}>Ver contrato</a></Button>;
  if (status !== "aprobada") return null;
  return <Button size="sm" asChild><a href={`${contractsPath}/nuevo?solicitud=${encodeURIComponent(solicitudId)}`}>Generar contrato</a></Button>;
}
