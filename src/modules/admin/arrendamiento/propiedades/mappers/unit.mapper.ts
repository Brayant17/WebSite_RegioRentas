import type { CreateUnitDto } from "../dtos/CreateUnitDto";
import type { UnidadForm } from "../schemas/unidad.schema";
import type { UpdateUnitDto } from "../dtos/UpdateUnitDto";

export function toCreateUnit(form: UnidadForm, id: string): CreateUnitDto{
  return {
    edificio_id: id,
    nombre: form.nombre,
    numero: form.numero,
    piso: form.piso,
    tipo: form.tipo,
    recamaras: form.recamaras,
    area: form.area,
    ubicacion: form.ubicacion,
    precio_renta: String(form.precio_renta),
    estatus: "Disponible"
  } 
}

export function toUpdateUnit(form: UnidadForm, edificioId: string, idUnidad: number): UpdateUnitDto{
  return {
    id: idUnidad,
    edificio_id: edificioId,
    nombre: form.nombre,
    numero: form.numero,
    piso: form.piso,
    tipo: form.tipo,
    recamaras: form.recamaras,
    area: form.area,
    ubicacion: form.ubicacion,
    precio_renta: String(form.precio_renta),
    estatus: "Disponible" //<- debe de ser disponible o otra cosa
  }
}