import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataItem } from "@/modules/admin/arrendamiento/components/DataItem";
import { useLandlordSettings } from "./hooks/useLandlordSettings";
import { representativeCharacters, type CompanyFields } from "./types";

const fields: { name: keyof CompanyFields; label: string; type?: "email" | "tel"; wide?: boolean }[] = [
  { name: "razon_social", label: "Razón social *", wide: true },
  { name: "nombre_comercial", label: "Nombre comercial", wide: true },
  { name: "rfc", label: "RFC" },
  { name: "domicilio", label: "Domicilio", wide: true },
  { name: "ciudad", label: "Ciudad" },
  { name: "estado", label: "Estado" },
  { name: "codigo_postal", label: "Código postal" },
  { name: "telefono", label: "Teléfono", type: "tel" },
  { name: "correo", label: "Correo", type: "email", wide: true },
];

export default function LandlordSettingsPage() {
  const { data, values, loading, saving, error, success, change, save, reload } = useLandlordSettings();
  const representative = data?.representative;
  const person = representative?.persona;
  const name = person ? [person.nombre, person.apellido_paterno, person.apellido_materno].filter(Boolean).join(" ") : "";
  const validCharacter = values && Object.hasOwn(representativeCharacters, values.caracter);
  return <div className="max-w-4xl space-y-6">
    <header className="space-y-1">
      <h1 className="text-xl font-semibold">Datos del arrendador</h1>
      <p className="text-sm text-muted-foreground">Información de la persona moral arrendadora y de su representante principal.</p>
    </header>
    {loading ? <p role="status">Cargando datos del arrendador…</p> : !data || !values ? <div className="space-y-3 rounded-lg border p-5">
      <p role="alert" className="text-sm text-destructive">{error ?? "No hay datos disponibles del arrendador."}</p>
      <Button variant="outline" onClick={reload}>Volver a cargar datos</Button>
    </div> : <form noValidate className="space-y-6" aria-busy={saving} onSubmit={event => { event.preventDefault(); void save(); }}>
      <section className="space-y-5 rounded-2xl border bg-background/80 p-5 shadow-sm sm:p-6" aria-labelledby="company-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="company-title" className="text-lg font-semibold">Datos de la persona moral</h2>
          <div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">Estatus</span><Badge variant="outline">{data.company.estatus || "Sin dato"}</Badge></div>
        </div>
        <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">Datos editables de la persona moral</legend>
          {fields.map(field => <div key={field.name} className={`space-y-2 ${field.wide ? "sm:col-span-2" : ""}`}>
            <Label htmlFor={`landlord-${field.name}`}>{field.label}</Label>
            <Input id={`landlord-${field.name}`} name={field.name} type={field.type ?? "text"}
              required={field.name === "razon_social"} value={values[field.name]} onChange={event => change(field.name, event.target.value)} />
          </div>)}
        </fieldset>
      </section>
      <section className="space-y-5 rounded-2xl border bg-background/80 p-5 shadow-sm sm:p-6" aria-labelledby="representative-title">
        <h2 id="representative-title" className="text-lg font-semibold">Representante principal</h2>
        {!representative ? <p className="text-sm text-muted-foreground">No hay un representante principal configurado. Puedes actualizar los datos de la persona moral.</p> : <>
          <div className="grid gap-5 sm:grid-cols-2">
            <DataItem label="Nombre completo" value={name || "Sin dato disponible"} wide />
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="representative-character">Carácter</Label>
              <Select disabled={saving} value={validCharacter ? values.caracter : ""} onValueChange={value => change("caracter", value)}>
                <SelectTrigger id="representative-character" className="w-full sm:max-w-sm"><SelectValue placeholder="Selecciona el carácter" /></SelectTrigger>
                <SelectContent>{Object.entries(representativeCharacters).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
              {!validCharacter && <p className="text-sm text-muted-foreground">{values.caracter ? `Carácter registrado no reconocido: ${values.caracter}. Selecciona una opción válida.` : "No hay un carácter registrado. Selecciona una opción para guardar."}</p>}
            </div>
            <DataItem label="Teléfono" value={person?.telefono || "Sin dato"} />
            <DataItem label="Correo" value={person?.correo || "Sin dato"} />
          </div>
          <p className="text-sm text-muted-foreground">El nombre y los datos de contacto pertenecen al registro de la persona y se muestran únicamente para consulta.</p>
        </>}
      </section>
      {error && <div className="space-y-3" role="alert">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" disabled={saving} onClick={reload}>Descartar lo capturado y volver a cargar datos</Button>
      </div>}
      {success && <p role="status" className="text-sm">{success}</p>}
      <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
    </form>}
  </div>;
}
