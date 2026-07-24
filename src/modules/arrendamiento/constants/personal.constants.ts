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

export const employmentStatusOptions: EnumOption[] = [
    { value: "empleado", label: "Empleado" },
    { value: "independiente", label: "Independiente" },
    { value: "empresario", label: "Empresario" },
    { value: "pensionado", label: "Pensionado" },
    { value: "estudiante", label: "Estudiante" },
    { value: "otro", label: "Otro" },
];

export const employmentDurationOptions: EnumOption[] = [
    { value: "MENOS_6_MESES", label: "Menos de 6 meses" },
    { value: "DE_6_A_12_MESES", label: "De 6 a 12 meses" },
    { value: "DE_1_A_2_ANIOS", label: "De 1 a 2 años" },
    { value: "DE_2_A_5_ANIOS", label: "De 2 a 5 años" },
    { value: "DE_5_A_10_ANIOS", label: "De 5 a 10 años" },
    { value: "MAS_10_ANIOS", label: "Más de 10 años" },
];