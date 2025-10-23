//Filters.jsx
import { motion, AnimatePresence } from "framer-motion";
import { useFilters } from "../filters/FilterContext";
import Dropdown from "../ui/DropdownMenu";

export default function Filters() {
    const { filters, setFilter, clearFilters } = useFilters();
    const keysToCheck = ['zone', 'type' ];
    const allSelectedNull = keysToCheck.every(key => filters[key] === null);

    const getCurrentFilterLabel = () => {
        if (!filters.type && !filters.operation) return null;

        if (filters.operation === "Renta") {
            if (filters.type === "Departamento") {
                return "Rentar depa";
            }
            return `Rentar ${filters.type || ""}`.trim();
        }
        if (filters.operation === "Venta") return `Comprar ${filters.type || ""}`.trim();

        return null;
    };

    const filterVariants = {
        hidden: { opacity: 0, y: -20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: "easeOut", delay: 0.4 }
        },
        exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: "easeIn" } }
    };

    // Instrucciones de Dropdown
    const optionsType = [
        { label: "Todas", value: { type: null, operation: null } },
        { label: "Rentar depa", value: { type: "Departamento", operation: "Renta" } },
        { label: "Rentar casa", value: { type: "Casa", operation: "Renta" } },
        { label: "Rentar cabaña", value: { type: "Cabaña", operation: "Renta" } },
        { label: "Rentar bodega", value: { type: "Bodega", operation: "Renta" } },
        { label: "Rentar terreno", value: { type: "Terreno", operation: "Renta" } },
        { label: "Rentar Local", value: { type: "Local", operation: "Renta" } },
        { label: "Comprar depa ", value: { type: "Departamento", operation: "Venta" } },
        { label: "Comprar casa", value: { type: "Casa", operation: "Venta" } },
        { label: "Comprar cabaña", value: { type: "Cabaña", operation: "Venta" } },
        { label: "Comprar bodega", value: { type: "Bodega", operation: "Venta" } },
        { label: "Comprar terreno", value: { type: "Terreno", operation: "Venta" } },
        { label: "Comprar local", value: { type: "Local", operation: "Venta" } },
    ]

    const zonas = [
        { label: "Todas", value: null },
        { label: "Cumbres", value: "Cumbres" },
        { label: "Centro", value: "Centro" },
        { label: "Mitras Centro y área Médica", value: "Mitras Centro y área Médica" },
        { label: "San Pedro", value: "San Pedro" },
        { label: "Carretera Nacional", value: "Carretera Nacional" },
        { label: "Guadalupe", value: "Guadalupe" },
        { label: "Apodaca", value: "Apodaca" },
        { label: "Gral. Escobedo", value: "Gral. Escobedo" },
        { label: "San Nicolás", value: "San Nicolás" },
        { label: "Santa Catarina", value: "Santa Catarina" },
        { label: "García", value: "García" },
        { label: "Juárez", value: "Juárez" },
    ];

    const handleSelectType = (option) => {
        const operation = option.value.operation;
        setFilter('operation', operation);
        const type = option.value.type;
        setFilter('type', type);
    }

    const handleSelectZone = (option) => {
        const zone = option.value;
        setFilter("zone", zone);
    }

    const handleClearSelections = () => {
        clearFilters();
    }

    return (
        <AnimatePresence>
            <motion.div
                key="filters-bar"
                className="flex flex-row justify-between items-center px-4 md:px-20 pb-4 border-b border-gray-200 bg-white"
                variants={filterVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                <div className="flex flex-col justify-center items-center sm:flex-row gap-2.5">
                    <Dropdown title="Que buscas?" options={optionsType} onSelect={handleSelectType} initialSelect={getCurrentFilterLabel()} />
                    <Dropdown title="Zona" options={zonas} onSelect={handleSelectZone} initialSelect={filters.zone} />
                    {
                        !allSelectedNull && (
                            <span
                                onClick={handleClearSelections}
                                className="text-xs underline flex gap-0.5 items-center cursor-pointer"
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="icon icon-tabler icons-tabler-outline icon-tabler-x"
                                >
                                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                    <path d="M18 6l-12 12" />
                                    <path d="M6 6l12 12" />
                                </svg>
                                Quitar selecciones
                            </span>

                        )
                    }
                </div>
                <div>
                    <div>
                        <a
                            href="/login"
                            className="block px-4 py-2 text-sm font-semibold text-[#C40001] bg-[#FAE4E4] border border-[#C40001]/10 rounded transition-all duration-200 hover:bg-[#FAD4D4] hover:shadow-md hover:-translate-y-0.5"
                        >
                            Publicar propiedad
                        </a>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
