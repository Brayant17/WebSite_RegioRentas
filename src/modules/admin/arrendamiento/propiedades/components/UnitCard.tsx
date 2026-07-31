import { AlertTriangle, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { C } from "@/modules/admin/arrendamiento/propiedades/constants/c"
import { UnitStatusBadge } from "./UnitStatusBadge";
import type { UnitDTO } from "../view-models/UnitCardViewModel";

export function UnitCard({ unit, onEdit }: { unit: UnitDTO, onEdit: () => void }) {
  const isAvailable = unit.status === "Disponible";

  return (
    <div
      className="rounded-xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer"
      style={{
        backgroundColor: isAvailable ? "#f9fafb" : "#fff",
        border: `1px ${isAvailable ? "dashed" : "solid"} ${C.border}`,
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div
            className="rounded-lg flex items-center justify-center font-bold text-lg shrink-0"
            style={{
              width: 40,
              height: 40,
              backgroundColor: isAvailable ? "#e5e7eb" : "#dcfce7",
              color: isAvailable ? "#4b5563" : "#16a34a",
            }}
          >
            {unit.id}
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ color: C.text }}>
              {unit.name}
            </h3>
            <span className="text-xs" style={{ color: C.textMuted }}>
              Piso {unit.floor} &bull; {unit.location}
            </span>
          </div>
        </div>
        <UnitStatusBadge status={unit.status} />
      </div>

      <div
        className="grid grid-cols-2 gap-4 mb-4"
        style={{ opacity: isAvailable ? 0.75 : 1 }}
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase font-bold" style={{ color: C.placeholder }}>
            Inquilino
          </span>
          {unit.tenant ? (
            <div className="flex items-center gap-2">
              {unit.tenant.avatarUrl ? (
                <div
                  className="rounded-full bg-cover bg-center shrink-0"
                  style={{ width: 24, height: 24, backgroundImage: `url("${unit.tenant.avatarUrl}")` }}
                />
              ) : (
                <div
                  className="rounded-full flex items-center justify-center text-xs font-bold shrink-0 outline-red-600 outline-1"
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: unit.tenant.initialsBg,
                    color: unit.tenant.initialsText,
                  }}
                >
                  {unit.tenant.initials}
                </div>
              )}
              <span className="text-sm font-medium" style={{ color: C.text }}>
                {unit.tenant.name}
              </span>
            </div>
          ) : (
            <span className="text-sm font-medium italic" style={{ color: C.textMuted }}>
              -- Vacante --
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase font-bold" style={{ color: C.placeholder }}>
            {isAvailable ? "Estado" : "Contrato"}
          </span>
          <span className="text-sm font-medium" style={{ color: C.text }}>
            {isAvailable ? "Listo para habitar" : `Vence: ${unit.contractEnds}`}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase font-bold" style={{ color: C.placeholder }}>
            Características
          </span>
          <span className="text-sm font-medium" style={{ color: C.text }}>
            {unit.bedrooms} Hab &bull; {unit.area}m&sup2;
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase font-bold" style={{ color: C.placeholder }}>
            {isAvailable ? "Renta Sugerida" : "Renta Actual"}
          </span>
          <span className="text-sm font-bold" style={{ color: C.text }}>
            ${(isAvailable ? unit.suggestedRent : unit.rent).toLocaleString()}.00
            {!isAvailable && (
              <span className="text-xs font-normal" style={{ color: C.textMuted }}>
                {" "}
                /mes
              </span>
            )}
          </span>
        </div>
      </div>

      <div
        className="flex items-center justify-between pt-3 mt-1"
        style={{ borderTop: `1px solid ${C.borderLight}` }}
      >
        {isAvailable ? (
          <span
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: C.textMuted }}
          >
            <Clock size={14} /> {unit.vacantSince}
          </span>
        ) : unit.payment === "pendiente" ? (
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: "#ef4444" }}>
            <AlertTriangle size={14} /> Pago pendiente
          </span>
        ) : (
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: "#16a34a" }}>
            <CheckCircle2 size={14} /> Pago al día
          </span>
        )}
        <span
          className="text-sm font-bold flex items-center gap-1"
          style={{ color: C.primary }}
          onClick={onEdit}
        >
          {isAvailable ? "Gestionar" : "Detalles"} <ArrowRight size={16} />
        </span>
      </div>
    </div>
  );
}