import { createContext, useContext, useEffect, useState } from "react";

export const FiltersContext = createContext(); // creando el contexto

export function FiltersProvider({ children }) {
  const [filters, setFilters] = useState({
    type: null,
    operation: null,
    zone: null,
    price: null
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("filters");
      if (stored) {
        setFilters(JSON.parse(stored));
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("filters", JSON.stringify(filters));
    }
  }, [filters])

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const clearFilters = () => {
    setFilters({
      type: null,
      operation: null,
      zone: null,
      price: null
    })
  }

  return (
    /* Pasando el provedor */
    <FiltersContext.Provider value={{ filters, setFilter, clearFilters }}>
      {children}
    </FiltersContext.Provider>
  );
}

export const useFilters = () => useContext(FiltersContext);