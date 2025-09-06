import { useEffect, useRef, useState } from "react";
import { PropertyCard } from "./PropertyCard.jsx";
import { useFilters } from "../filters/FilterContext.jsx";

export default function PropertyList({ limit = 24 }) {
  const { filters } = useFilters();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const loadRef = useRef(null);

  const fetchProperties = async () => {
    setLoading(true);

    const start = page * limit;

    try {
      const res = await fetch(
        `/api/propiedades?start=${start}&limit=${limit}&type=${filters.type}`
      );
      const data = await res.json();

      if (data.length === 0) {
        setHasMore(false);
      } else {
        setProperties((prev) => [...prev, ...data]);
      }
    } catch (error) {
      console.log("Error cargando propiedades: ", error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProperties();
  }, [page]);

  useEffect(() => {
    // cada vez que cambian los filtros, reinicio la lista
    setProperties([]);
    setHasMore(true);
    setPage(0);
  }, [filters]);


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
  }, [hasMore, loading]);

  return (
    <div className="w-11/12 m-auto py-24">
      <section className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4">
        {properties.map(({ id, ...moreData }) => (
          <PropertyCard key={id} id={id} property={moreData} slug={"1"} />
        ))}
      </section>
      {loading && <p className="text-center py-4">Cargando...</p>}
      {hasMore && !loading && (
        <div ref={loadRef} className=""></div>
      )}
    </div>
  );
}
