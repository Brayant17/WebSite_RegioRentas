import { createContext, useContext, useState } from "react";

export const FiltersContext = createContext(); // creando el contexto

export function FiltersProvider({ children }) {
  const [filters, setFilters] = useState({
    type: null // Incialmente ningun seleccionado
  });
  return (
    /* Pasando el provedor */
    <FiltersContext.Provider value={{ filters, setFilters }}>
      {children}
    </FiltersContext.Provider>
  );
}

export const useFilters = () => useContext(FiltersContext);