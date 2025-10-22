import { motion, AnimatePresence } from "framer-motion";
import { useFilters } from "../filters/FilterContext";
import Dropdown from "../ui/DropdownMenu";

export default function Filters() {
    const { setFilter } = useFilters();

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

    return (
        <AnimatePresence>
            <motion.div
                key="filters-bar"
                className="flex flex-row justify-between items-center px-4 md:px-20 pb-4 border-b border-gray-200 bg-white sticky top-0 z-10"
                variants={filterVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                <div className="flex flex-col sm:flex-row gap-2.5">
                    <Dropdown title="Que buscas?" options={optionsType} onSelect={handleSelectType} />
                    <Dropdown title="Zona" options={zonas} onSelect={handleSelectZone} />
                </div>
                <div>
                    <div>
                        <button className="inline-flex items-center gap-2 px-4 py-2.5 md:py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 transition-colors duration-200 ease-in-out rounded-lg text-white text-sm md:text-base font-medium shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 cursor-pointer">
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="icon icon-tabler icon-tabler-brand-whatsapp"
                            >
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
                                <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />
                            </svg>
                            <span>Contactar</span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
