import type { CreateApplicationDTO } from "../dtos/create-application-dto";
import { HasGuarantor, type RentalApplication } from "../types/rental";

export function toCreateApplicationDTO(application: RentalApplication): CreateApplicationDTO {
    return {
        unidad: {
            unidad_id: application.propertyId,
            fecha_estimada_ocupacion: application.ocupationDate,
        },
        datos_personales: {
            nombre: application.personal.firstName,
            apellido_paterno: application.personal.paternalLastName,
            apellido_materno: application.personal.maternalLastName,
            correo: application.personal.email,
            telefono: application.personal.phone,
            direccion: application.personal.address,
            rfc: application.personal.rfc ?? "",
            curp: application.personal.curp ?? "",
            sexo: application.personal.gender ?? "",
            estado_civil: application.personal.martialStatus ?? ""
        },
        informacion_laboral: {
            situacion_laboral: application.employment.employmentStatus ?? "",
            antiguedad: application.employment.employmentDuration ?? "",
            empresa: application.employment.company,
            puesto: application.employment.position,
            ingreso_mensual: application.employment.monthlyIncome,
            supervisor: application.employment.supervisorName,
            telefono_empresa: application.employment.phoneCompany,
        },
        fiador:
            application.guarantor.hasGuarantor === HasGuarantor.Si
                ? {
                    nombre: application.guarantor.firstName,
                    apellido_paterno: application.guarantor.paternalLastName,
                    apellido_materno: application.guarantor.maternalLastName,
                    correo: application.guarantor.email,
                    telefono: application.guarantor.phone,
                    parentesco: application.guarantor.relationship ?? ""
                }
                : undefined,
        referencias: application.references.map(reference => ({
            nombre: reference.fullName,
            telefono: reference.phone,
            parentesco: reference.relationship ?? "", // <- Revisar mas detalle
        }))
    };
}