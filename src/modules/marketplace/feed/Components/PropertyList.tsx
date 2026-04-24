import { motion, AnimatePresence } from "framer-motion";
import { PropertyCard } from "@/components/PropertyCard/PropertyCard.tsx";
import SkeletonCard from "@/components/SkeletonCard.jsx"
import { useFilters } from "../context/FilterContext.jsx";
import { useUser } from "@/hooks/useUser.ts";
import { useFavorites } from "../hooks/useFavorites.js";
import { useProperties } from "../hooks/useProperties.js";

// ── Animation variants ────────────────────────────────────────────────────────

const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeInOut" as const} },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function PropertyList({ limit = 24 }) {
    const { filters } = useFilters();

    const { session } = useUser();
    const { favorites } = useFavorites({ session });
    const { properties, loading, hasMore, loadRef } = useProperties({ filters, limit });

    const isInitializing = !filters._initialized || (loading && properties.length === 0);

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key="main-content"
                className="w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <motion.section
                    className="w-11/12 m-auto py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    {/* ── Loading skeleton ────────────────────────────────────────── */}
                    {isInitializing ? (
                        Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)

                        /* ── Property cards ─────────────────────────────────────────── */
                    ) : properties.length > 0 ? (
                        properties.map((property) => (
                            <motion.div key={property.id} variants={itemVariants}>
                                <PropertyCard
                                    property={property}      // images[] already normalized in service
                                    isFavorite={favorites.includes(property.id)}
                                />
                            </motion.div>
                        ))

                        /* ── Empty state ────────────────────────────────────────────── */
                    ) : (
                        !loading && (
                            <motion.div
                                className="col-span-full flex flex-col items-center justify-center py-16 text-gray-500"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                            >
                                <p className="text-lg font-medium">No se encontraron resultados</p>
                                <p className="text-sm text-gray-400">Intenta ajustar tus filtros.</p>
                            </motion.div>
                        )
                    )}
                </motion.section>

                {/* ── Infinite scroll: "loading more" indicator ─────────────────────── */}
                {loading && properties.length > 0 && (
                    <motion.p
                        className="text-center py-4 text-gray-500"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        Cargando más...
                    </motion.p>
                )}

                {/* ── Infinite scroll: sentinel element ────────────────────────────── */}
                {hasMore && !loading && <div ref={loadRef} />}
            </motion.div>
        </AnimatePresence>
    );
} 