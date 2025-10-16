import { motion } from "framer-motion";
import MenuIcons from "../filters/MenuIcons.jsx";
import { useFilters } from "../filters/FilterContext.jsx";

export default function FirstMenu() {
    const { filters, setFilterType } = useFilters();

    const handleSelect = (type) => {
        setFilterType(type);
    };

    // Variants para animaciones principales
    const containerVariants = {
        hidden: { opacity: 0, y: 50 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.8, ease: "easeOut", staggerChildren: 0.2 }
        }
    };

    const textVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
    };

    const imgVariants = {
        hidden: { opacity: 0, y: 50 },
        visible: { opacity: 1, y: 0, transition: { duration: 1, ease: "easeOut" } }
    };

    return (
        <motion.div
            className="relative w-full h-full flex-col justify-center items-center py-24"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <motion.div className="z-10 flex flex-col justify-center items-center gap-4 mb-12 text-center">
                <motion.h3
                    className="text-4xl font-bold"
                    variants={textVariants}
                >
                    Encuentra el lugar perfecto para ti
                </motion.h3>
                <motion.p
                    className="text-xl"
                    variants={textVariants}
                >
                    Elige el tipo de propiedad que estás buscando
                </motion.p>

                {/* Aquí pasamos animación extra a los íconos */}
                <MenuIcons handleSelect={handleSelect} filters={filters} />
            </motion.div>

            <motion.img
                className="absolute bottom-0 left-0 -z-10 w-full object-cover"
                src="/mockup-city.png"
                alt=""
                variants={imgVariants}
            />
        </motion.div>
    );
}
