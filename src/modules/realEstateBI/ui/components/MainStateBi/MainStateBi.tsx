import { motion } from "framer-motion";
import { Building2, MousePointerClick } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import BuildingDetails from "./BuildingDetails";
import type { PropertyDTO } from "@/modules/realEstateBI/application/dtos/PropertyDTO";

export default function MainStateBi({ property, onPropertyUpdate }: { property: PropertyDTO | null, onPropertyUpdate: () => void }) {
    return (
        <div className="bg-slate-50/50 min-h-full flex w-full overflow-hidden">
            {property ? (
                <motion.div
                    key={property.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="w-full flex-1"
                >
                    <BuildingDetails property={property} onPropertyUpdate={onPropertyUpdate} />
                </motion.div>
            ) : (
                <div className="flex-1 flex items-center justify-center p-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card className="border-dashed bg-transparent border-2 shadow-none max-w-md">
                            <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                <div className="relative mb-4">
                                    <div className="absolute inset-0 scale-150 blur-3xl bg-primary/10 rounded-full" />
                                    <div className="relative size-20 rounded-full bg-white shadow-sm border flex items-center justify-center">
                                        <Building2 className="size-10 text-slate-400" />
                                        <motion.div
                                            animate={{ y: [0, -4, 0], x: [0, 4, 0] }}
                                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                            className="absolute -bottom-1 -right-1 bg-primary text-white p-1.5 rounded-lg shadow-lg"
                                        >
                                            <MousePointerClick size={16} />
                                        </motion.div>
                                    </div>
                                </div>
                                <h2 className="text-xl font-semibold text-slate-900 mb-2">No hay propiedad seleccionada</h2>
                                <p className="text-slate-500 max-w-[250px] text-sm">
                                    Selecciona un edificio del menú lateral para visualizar sus indicadores y métricas detalladas.
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            )}
        </div>
    );
}