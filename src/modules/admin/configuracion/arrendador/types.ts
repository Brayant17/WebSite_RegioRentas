export const representativeCharacters = {
  REPRESENTANTE_LEGAL: "Representante legal",
  APODERADO_LEGAL: "Apoderado legal",
  ADMINISTRADOR: "Administrador",
  OTRO: "Otro",
} as const;

export type RepresentativeCharacter = keyof typeof representativeCharacters;

export interface CompanyFields {
  razon_social: string;
  nombre_comercial: string | null;
  rfc: string | null;
  domicilio: string | null;
  ciudad: string | null;
  estado: string | null;
  codigo_postal: string | null;
  telefono: string | null;
  correo: string | null;
}

export interface LandlordCompany extends CompanyFields {
  id: string;
  estatus: string | null;
}

export interface LandlordRepresentative {
  id: string;
  persona_moral_id: string;
  persona_id: string;
  caracter: string | null;
  es_principal: boolean;
  persona: {
    nombre: string | null;
    apellido_paterno: string | null;
    apellido_materno: string | null;
    telefono: string | null;
    correo: string | null;
  } | null;
}

export interface LandlordSettings {
  company: LandlordCompany;
  representative: LandlordRepresentative | null;
}

export type LandlordFormValues = { [K in keyof CompanyFields]: string } & { caracter: string };
