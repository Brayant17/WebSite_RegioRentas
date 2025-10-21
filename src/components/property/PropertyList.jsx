import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { PropertyCard } from "./PropertyCard.jsx";
import { useFilters } from "../filters/FilterContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import Filters from "../filters/Filters.jsx"

export default function PropertyList({ limit = 24 }) {
  const { filters } = useFilters();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadRef = useRef(null);

  // Fetch desde Supabase con JOIN a property_images
  const fetchProperties = async (currentPage, currentType) => {
    setLoading(true);
    const start = currentPage * limit;
    const end = start + limit - 1;

    try {
      let query = supabase
        .from("properties")
        .select(`
        id,
        title,
        description,
        price,
        municipio,
        colonia,
        slug,
        property_type,
        property_images (
          url
        )
      `)
        .range(start, end);

      // 👇 Si hay filtro, aplicamos el .eq()
      if (currentType) {
        query = query.eq("property_type", currentType);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error al obtener datos de Supabase:", error);
        return;
      }

      if (currentPage === 0) {
        setProperties(data);
      } else {
        setProperties((prev) => [...prev, ...data]);
      }

      setHasMore(data.length === limit);
    } catch (error) {
      console.error("Error cargando propiedades:", error);
    }

    setLoading(false);
  };


  useEffect(() => {
    fetchProperties(page, filters.type);
  }, [page, filters.type]);

  useEffect(() => {
    setPage(0);
    setHasMore(true);
  }, [filters.type]);

  useEffect(() => {
    if (!hasMore || loading) return;
    if (!loadRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, page]);

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1, delayChildren: 0.6 } },
    exit: {}
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.4, ease: "easeIn" } }
  };

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
          {properties.map((property) => (
            <motion.div key={property.id} variants={itemVariants}>
              <PropertyCard
                key={property.id}
                id={property.id}
                property={{
                  ...property,
                  images: property.property_images?.map((img) => img.url) || []
                }}
                slug={property.slug}
              />
            </motion.div>
          ))}
        </motion.section>

        {loading && <p className="text-center py-4">Cargando...</p>}
        {hasMore && !loading && <div ref={loadRef} />}
      </motion.div>
    </AnimatePresence>
  );
}
