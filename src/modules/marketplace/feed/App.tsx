// App.jsx
import { FiltersProvider } from "./context/FilterContext.jsx";
import Filters from "./filters/Filters.jsx";
import PropertyList from "./Components/PropertyList.tsx";

export default function App() {
    return (
        <FiltersProvider>
            <Filters />
            <PropertyList />
        </FiltersProvider>
    );
}