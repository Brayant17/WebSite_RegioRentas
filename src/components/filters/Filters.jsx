import { motion, AnimatePresence } from "framer-motion";
import ModalFilters from "./ModalFilters"
import { useFilters } from "../filters/FilterContext";
import MenuIcons from "./MenuIcons";

export default function Filters() {
    const { filters, setFilterType } = useFilters();

    const handleSelect = (type) => {
        setFilterType(type);
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

    return (
        <AnimatePresence>
            <motion.div
                key="filters-bar"
                className="flex flex-row justify-between items-center px-4 md:px-20 border-b border-gray-200 bg-white sticky top-0 z-10"
                variants={filterVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                <h2>Logo</h2>
                <MenuIcons handleSelect={handleSelect} filters={filters} />
                <ModalFilters title={"Filtros"}>
                    <span className="hidden md:block">Filtros</span>
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="icon icon-tabler icon-tabler-adjustments-horizontal"
                    >
                        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                        <path d="M14 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                        <path d="M4 6h8" />
                        <path d="M16 6h4" />
                        <path d="M8 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                        <path d="M4 12h2" />
                        <path d="M10 12h10" />
                        <path d="M17 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                        <path d="M4 18h11" />
                        <path d="M19 18h1" />
                    </svg>
                </ModalFilters>
            </motion.div>
        </AnimatePresence>
    );
}
