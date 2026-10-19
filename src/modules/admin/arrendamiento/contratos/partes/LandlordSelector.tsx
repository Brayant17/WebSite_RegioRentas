import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDefaultLandlord, getLandlordOption, searchLandlords, type LandlordOption } from "./partes.repository";
import type { LandlordSelection, LandlordType } from "./model";

export function LandlordSelector({ value, onChange, disabled = false, useDefault = false }: {
  value: LandlordSelection | null; onChange: (value: LandlordSelection | null) => void; disabled?: boolean; useDefault?: boolean;
}) {
  const id = useId();
  const touched = useRef(false);
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  const [tipo, setTipo] = useState<LandlordType>(value?.tipo ?? "PERSONA_MORAL");
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<LandlordOption[]>([]);
  const [selected, setSelected] = useState<LandlordOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultWarning, setDefaultWarning] = useState(false);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (useDefault && !value) getDefaultLandlord().then(defaultValue => {
      if (!cancelled && !touched.current && defaultValue) { setTipo(defaultValue.tipo); onChangeRef.current(defaultValue); }
    }).catch(() => { if (!cancelled) setDefaultWarning(true); });
    return () => { cancelled = true; };
  }, [useDefault]);
  useEffect(() => {
    let cancelled = false;
    setSelected(null);
    if (value) getLandlordOption(value).then(option => { if (!cancelled) setSelected(option); }).catch(() => { if (!cancelled) setError("No se pudo consultar el arrendador seleccionado."); });
    return () => { cancelled = true; };
  }, [value?.tipo, value?.id]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setOptions([]);
    const timer = setTimeout(() => searchLandlords(tipo, search).then(rows => { if (!cancelled) setOptions(rows); })
      .catch(() => { if (!cancelled) setError("No se pudieron consultar los arrendadores. Revisa tus permisos o vuelve a buscar."); })
      .finally(() => { if (!cancelled) setLoading(false); }), 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [tipo, search]);
  const choices = selected && !options.some(option => option.id === selected.id) ? [selected, ...options] : options;
  return <fieldset disabled={disabled} className="space-y-3 rounded-lg border p-4">
    <legend className="px-1 font-medium">Arrendador</legend>
    <Label htmlFor={`${id}-type`}>Tipo de persona</Label>
    <select id={`${id}-type`} className="w-full rounded-md border bg-background p-2" value={tipo} onChange={event => {
      touched.current = true; setTipo(event.target.value as LandlordType); setSearch(""); onChange(null);
    }}><option value="PERSONA_MORAL">Persona moral</option><option value="PERSONA">Persona física</option></select>
    <Label htmlFor={`${id}-search`}>Buscar {tipo === "PERSONA" ? "persona por nombre, apellido o RFC" : "persona moral por razón social"}</Label>
    <Input id={`${id}-search`} value={search} onChange={event => { touched.current = true; setSearch(event.target.value); }} placeholder="Escribe para buscar" />
    <Label htmlFor={`${id}-landlord`}>Arrendador seleccionado</Label>
    <select id={`${id}-landlord`} required className="w-full rounded-md border bg-background p-2" value={value?.tipo === tipo ? value.id : ""}
      onChange={event => { touched.current = true; onChange(event.target.value ? { tipo, id: event.target.value } : null); }}>
      <option value="">Selecciona un arrendador</option>
      {choices.map(option => <option key={option.id} value={option.id}>{option.nombre}{option.rfc ? ` · ${option.rfc}` : ""} · {option.id.slice(0, 8)}</option>)}
    </select>
    {loading && <p role="status" className="text-sm">Buscando arrendadores…</p>}
    {!loading && !options.length && <p className="text-sm">No hay resultados para esta búsqueda.</p>}
    <p className="text-sm text-muted-foreground">Se muestran hasta 40 resultados. Puedes cambiar el arrendador predeterminado.</p>
    {defaultWarning && <p role="status" className="text-sm">No se pudo cargar el predeterminado. Selecciona un arrendador de la lista.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="button" variant="outline" onClick={() => setAdding(!adding)}>+ Agregar arrendador</Button>
    {adding && <div role="status" className="space-y-2 text-sm">
      <p>Alta de {tipo === "PERSONA" ? "persona física" : "persona moral"}: solicita su registro al responsable de datos. El alta desde esta pantalla aún no está disponible.</p>
      <p>Antes de solicitarla, busca si la persona ya existe, incluso como representante legal.</p>
    </div>}
  </fieldset>;
}
