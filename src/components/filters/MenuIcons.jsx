import { motion } from "framer-motion";
import ImageIcon from "../React/ImageIcon";
import BuildingIcon from "../../assets/building-tower.png";
import wareHouseIcon from "../../assets/warehouse.png";
import houseIcon from "../../assets/house.png";
import cabinIcon from "../../assets/cabin.png";
import landIcon from "../../assets/building.png";

export default function MenuIcons({ handleSelect, filters }) {
    const icons = [
        { type: "Departamento", src: BuildingIcon.src, label: "Depa" },
        { type: "Casa", src: houseIcon.src, label: "Casa" },
        { type: "Bodega", src: wareHouseIcon.src, label: "Bodega" },
        { type: "Cabaña", src: cabinIcon.src, label: "Cabaña" },
        { type: "Terreno", src: landIcon.src, label: "Terreno" },
    ];

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
    };

    return (
        <motion.div
            className="flex flex-row gap-4 md:gap-8 items-center h-16"
            initial="hidden"
            animate="visible"
            transition={{ staggerChildren: 0.15 }}
        >
            {icons.map(({ type, src, label }) => (
                <motion.div
                    key={type}
                    variants={itemVariants}
                    whileHover={{ scale: 1.08, y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                >
                    <ImageIcon
                        type={type}
                        activeType={filters.type}
                        onClick={() => handleSelect(type)}
                    >
                        <img src={src} className="w-8" />
                        <span className="text-sm md:text-base text-gray-700">{label}</span>
                    </ImageIcon>
                </motion.div>
            ))}
        </motion.div>
    );
}
