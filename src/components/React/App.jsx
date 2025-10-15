// App.jsx
import { useState } from "react";
import { FiltersProvider } from "../filters/FilterContext.jsx";
import Filters from "../filters/Filters.jsx";
import PropertyList from "../property/PropertyList.jsx";

export default function App() {

    
    return (
        <FiltersProvider>
            <Filters />
            <PropertyList />
        </FiltersProvider>
    );
}