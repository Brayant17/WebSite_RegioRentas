// App.jsx
import { useState } from "react";
import { FiltersProvider } from "../filters/FilterContext.jsx";
import Filters from "../filters/Filters.jsx";
import PropertyList from "../property/PropertyList.jsx";

export default function App() {

    const [filter, setFilter] = useState({})
    
    return (
        <FiltersProvider>
            <Filters />
            <PropertyList />
        </FiltersProvider>
    );
}