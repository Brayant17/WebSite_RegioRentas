// src/modules/arrendamiento/constants/personal.constants.ts
import { Gender, martialStatus } from "@/modules/arrendamiento/types/rental";

export interface EnumOption {
    value: string;
    label: string;
}

export const genderOptions: EnumOption[] = [
    { value: Gender.Hombre, label: "Hombre" },
    { value: Gender.Mujer, label: "Mujer" },
    { value: Gender.NoDefinido, label: "Prefiero no decirlo" },
    // ajusta según tu enum real
];

export const martialStatusOptions: EnumOption[] = [
    { value: martialStatus.Soltero, label: "Soltero(a)" },
    { value: martialStatus.Casado, label: "Casado(a)" },
    { value: martialStatus.UnionLibre, label: "Unión libre" },
    { value: martialStatus.Divorciado, label: "Divorciado(a)" },
    { value: martialStatus.Viudo, label: "Viudo(a)" },
];