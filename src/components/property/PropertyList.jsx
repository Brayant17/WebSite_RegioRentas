// PropertyList
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { PropertyCard } from "./PropertyCard.jsx";
import { useFilters } from "../filters/FilterContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import SkeletonCard from "./SkeletonCard";

export default function PropertyList({ limit = 24 }) {
  const { filters } = useFilters();

  const [properties, setProperties] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadRef = useRef(null);

  // obtener session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) =>
      setSession(session)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  // 🚀 Fetch desde Supabase con filtros
  const fetchProperties = async (currentPage, filters) => {
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
          area,
          bedrooms,
          bathrooms,
          operation,
          slug,
          property_type,
          operation,
          property_images (url, order)
        `)
        .order("order", { foreignTable: "property_images", ascending: true })
        .range(start, end);

      // 🧠 Aplica los filtros
      if (filters.type) query = query.eq("property_type", filters.type);
      if (filters.operation) query = query.eq("operation", filters.operation);
      if (filters.zone) {
        const zone = filters.zone;
        query = query.or(
          `estado.ilike.%${zone}%,municipio.ilike.%${zone}%,colonia.ilike.%${zone}%,zona.ilike.%${zone}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error al obtener propiedades:", error);
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

  // 🧩 Efectos
  // 1️⃣ Re-fetch cuando filtros cambian o se inicializan
  useEffect(() => {
    if (!filters._initialized) return; // Espera hasta que los filtros se carguen del sessionStorage
    setPage(0);
    setHasMore(true);
    fetchProperties(0, filters);
  }, [filters]);

  // 2️⃣ Cargar más propiedades al hacer scroll
  useEffect(() => {
    if (!filters._initialized || !hasMore || loading) return;
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
  }, [filters, hasMore, loading]);

  // 3️⃣ Fetch siguiente página
  useEffect(() => {
    if (page === 0 || !filters._initialized) return;
    fetchProperties(page, filters);
  }, [page]);

  // fetch favortios del usuario (una sola vez)
  useEffect(() => {
    if (!session) {
      setFavorites([]); // 🔹 limpiar favoritos al cerrar sesión
      return;
    } // 🔹 espera hasta tener session

    const fetchFavorites = async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("property_id")
        .eq("user_id", session.user.id);

      if (error) {
        console.error("Error cargando favoritos:", error);
        return;
      }

      setFavorites(data?.map(fav => fav.property_id) || []);
    };

    fetchFavorites();
  }, [session])

  // 🎞️ Animaciones
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
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
          {/* ⏳ Si los filtros aún no se cargan o estamos cargando */}
          {!filters._initialized || (loading && properties.length === 0) ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          ) : properties?.length > 0 ? (
            properties.map((property) => (
              <motion.div key={property.id} variants={itemVariants}>
                <PropertyCard
                  id={property.id}
                  property={{
                    ...property,
                    images: property.property_images?.map((img) => img.url) || [],
                  }}
                  slug={property.slug}
                  isFavorite={favorites.includes(property.id)}
                  session={session}
                />
              </motion.div>
            ))
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

        {/* 🔁 Scroll infinito */}
        {loading && properties.length > 0 && (
          <motion.p
            className="text-center py-4 text-gray-500"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Cargando más...
          </motion.p>
        )}
        {hasMore && !loading && <div ref={loadRef} />}
      </motion.div>
    </AnimatePresence>
  );
}
