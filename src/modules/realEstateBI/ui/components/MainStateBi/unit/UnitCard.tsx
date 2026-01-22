import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion } from 'framer-motion';
import { History } from "lucide-react";

// --- Props ---
interface UnitCardProps {
    id: string;
    name: string;
    floor: string;
    tenant?: {
        name: string;
        avatar?: string;
        initials?: string;
    };
    status: 'Ocupado' | 'Disponible' | 'Mantenimiento' | 'Moroso';
    expiry?: string;
    features: string;
    rent: string;
    paymentStatus?: 'al día' | 'pendiente';
    vacantDays?: number;
}

export default function UnitCard({ id, name, floor, tenant, status, expiry, features, rent, paymentStatus, vacantDays }: UnitCardProps) {
    const isAvailable = status === 'Disponible';

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className={`group bg-white dark:bg-[#1a2634] rounded-xl border p-5 shadow-sm hover:shadow-md transition-all cursor-pointer
        ${isAvailable
                    ? 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50'
                    : 'border-slate-200 dark:border-slate-800 hover:border-primary/50'}`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-lg flex items-center justify-center font-bold text-lg
            ${isAvailable
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'}`}>
                        {id}
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{name}</h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{floor}</span>
                    </div>
                </div>
                <Badge variant={isAvailable ? "outline" : "default"}
                    className={isAvailable
                        ? "bg-white dark:bg-transparent"
                        : "bg-green-100 text-green-700 hover:bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"}>
                    {status}
                </Badge>
            </div>

            <div className={`grid grid-cols-2 gap-4 mb-4 ${isAvailable ? 'opacity-70' : ''}`}>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Inquilino</span>
                    {tenant ? (
                        <div className="flex items-center gap-2">
                            {tenant.avatar ? (
                                <div className="size-6 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${tenant.avatar})` }} />
                            ) : (
                                <div className="size-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                                    {tenant.initials}
                                </div>
                            )}
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{tenant.name}</span>
                        </div>
                    ) : (
                        <span className="text-sm font-medium text-slate-400 italic">-- Vacante --</span>
                    )}
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">{isAvailable ? 'Estado' : 'Contrato'}</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {isAvailable ? 'Listo para habitar' : `Vence: ${expiry}`}
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Características</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{features}</span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">{isAvailable ? 'Renta Sugerida' : 'Renta Actual'}</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {rent} {!isAvailable && <span className="text-xs font-normal text-slate-500">/mes</span>}
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
                <span className={`text-xs font-medium flex items-center gap-1 
          ${isAvailable ? 'text-slate-500' : paymentStatus === 'al día' ? 'text-green-600' : 'text-red-500'}`}>
                    {isAvailable ? (
                        <><History size={14} /> Vacío hace {vacantDays} días</>
                    ) : paymentStatus === 'al día' ? (
                        <><CheckCircle2 size={14} /> Pago al día</>
                    ) : (
                        <><AlertCircle size={14} /> Pago pendiente</>
                    )}
                </span>
                <span className="text-primary text-sm font-bold flex items-center gap-1 group-hover:underline transition-all">
                    {isAvailable ? 'Gestionar' : 'Detalles'} <ArrowRight size={14} />
                </span>
            </div>
        </motion.div>
    );
};
