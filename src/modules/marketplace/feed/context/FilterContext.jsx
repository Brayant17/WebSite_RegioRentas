import { createContext, useContext, useEffect, useState } from "react";

export const FiltersContext = createContext();

export function FiltersProvider({ children }) {
  const [filters, setFilters] = useState({
    type: null,
    operation: null,
    zone: null,
    price: null,
    _initialized: false
  });

  // ✅ Carga desde sessionStorage una vez que window existe
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = sessionStorage.getItem("filters");
    if (stored) {
      const parsed = JSON.parse(stored);
      setFilters({ ...parsed, _initialized: true });
    } else {
      setFilters((prev) => ({ ...prev, _initialized: true }));
    }
  }, []);

  // ✅ Guarda los filtros cuando ya están inicializados
  useEffect(() => {
    if (!filters._initialized) return; // evita guardar antes de tiempo
    const { _initialized, ...saveable } = filters;
    sessionStorage.setItem("filters", JSON.stringify(saveable));
  }, [filters]);

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      type: null,
      operation: null,
      zone: null,
      price: null,
      _initialized: true // ⚠️ mantenlo en true para no romper el flujo
    });
  };

  return (
    <FiltersContext.Provider value={{ filters, setFilter, clearFilters }}>
      {children}
    </FiltersContext.Provider>
  );
}

export const useFilters = () => useContext(FiltersContext);
