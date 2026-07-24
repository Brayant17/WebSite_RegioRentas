export interface CreateApplicationDTO {
    unidad: {
        unidad_id: number;
        fecha_estimada_ocupacion: string;
    },
    datos_personales: {
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string;
        correo: string;
        telefono: string;
        direccion: string;
    },
    informacion_laboral: {
        empresa: string;
        puesto: string;
        ingreso_mensual: number;
        supervisor?: string | null;
        telefono_empresa: string;
    },
    fiador?: {
        nombre: string;
        apellido_paterno: string;
        apellido_materno: string;
        correo: string;
        telefono: string;
    },
    referencias:
    {
        nombre: string;
        telefono: string;
        parentesco: string;
    }[],
}