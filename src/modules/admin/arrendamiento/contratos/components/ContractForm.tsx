import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContractFormValues } from "../types";

export default function ContractForm({ initialValues, saving, error, submitLabel, onSubmit, onCancel, children, disabled = false, editDraftVariables = false }: {
  initialValues: ContractFormValues;
  saving: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (values: ContractFormValues) => Promise<void>;
  onCancel?: () => void;
  children?: ReactNode;
  disabled?: boolean;
  editDraftVariables?: boolean;
}) {
  const [values, setValues] = useState(initialValues);
  const id = useId();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(values);
  }
  const fields = [
    { name: "fecha_inicio", label: "Fecha de inicio", type: "date" },
    { name: "fecha_fin", label: "Fecha de fin", type: "date" },
    { name: "renta", label: "Renta mensual (MXN)", type: "number", min: "0.01", max: "9999999999.99", step: "0.01" },
    { name: "deposito", label: "Depósito (MXN)", type: "number", min: "0", max: "9999999999.99", step: "0.01" },
    { name: "dia_pago", label: "Día de pago", type: "number", min: "1", max: "31", step: "1" },
  ] as const;
  return (
    <form onSubmit={submit} className="space-y-4">
      {children}
      <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Condiciones del contrato</legend>
        {fields.map(field => (
          <div className="space-y-2" key={field.name}>
            <Label htmlFor={`${id}-${field.name}`}>{field.label}</Label>
            <Input {...field} id={`${id}-${field.name}`} required value={values[field.name]}
              onChange={event => setValues(previous => ({ ...previous, [field.name]: event.target.value }))} />
          </div>
        ))}
        {editDraftVariables && <div className="space-y-2">
          <Label htmlFor={id + "-costo_lavanderia"}>Costo de lavandería (MXN)</Label>
          <Input id={id + "-costo_lavanderia"} name="costo_lavanderia" type="number" min="0" step="any"
            value={values.costo_lavanderia ?? ""}
            onChange={event => setValues(previous => ({ ...previous, costo_lavanderia: event.target.value }))} />
        </div>}
      </fieldset>
      {editDraftVariables && <fieldset disabled={saving} className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 font-semibold">Domicilios contractuales</legend>
        {([
          ["domicilio_arrendador", "Domicilio contractual del arrendador"],
          ["domicilio_arrendatario", "Domicilio contractual del arrendatario"],
          ["domicilio_fiador", "Domicilio contractual del fiador"],
        ] as const).map(([name, label]) => <div className="space-y-2" key={name}>
          <Label htmlFor={id + "-" + name}>{label}</Label>
          <textarea id={id + "-" + name} name={name} rows={3}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm disabled:opacity-50"
            value={values[name] ?? ""}
            onChange={event => setValues(previous => ({ ...previous, [name]: event.target.value }))} />
        </div>)}
      </fieldset>}
      {editDraftVariables && <fieldset disabled={saving} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <legend className="px-1 font-semibold">Firma</legend>
        <p className="text-sm text-muted-foreground sm:col-span-2">Lugar y fecha que aparecerán en el documento. Capturarlos no significa que el contrato esté firmado.</p>
        <div className="space-y-2">
          <Label htmlFor={id + "-lugar_firma"}>Lugar de firma</Label>
          <Input id={id + "-lugar_firma"} name="lugar_firma" type="text" value={values.lugar_firma ?? ""}
            onChange={event => setValues(previous => ({ ...previous, lugar_firma: event.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id + "-fecha_firma"}>Fecha de firma</Label>
          <Input id={id + "-fecha_firma"} name="fecha_firma" type="date" value={values.fecha_firma ?? ""}
            onChange={event => setValues(previous => ({ ...previous, fecha_firma: event.target.value }))} />
        </div>
      </fieldset>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving || disabled}>{saving ? "Guardando…" : submitLabel}</Button>
        {onCancel && <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Cancelar</Button>}
      </div>
    </form>
  );
}
