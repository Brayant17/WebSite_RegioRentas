import { useEffect, useState } from "react";
import Aside from "./components/aside/Aside";
import MainStateBi from "./components/MainStateBi/MainStateBi";
import { useRealEstateBI } from "./hooks/propiedades/useRealEstateBI";
import { useGetProperties } from "./hooks/propiedades/useGetProperties";
import { Button } from "@/components/ui/button";

export default function RealEstateBIDashboard() {

    const [asideOpen, setAsideOpen] = useState(true)

    const {
        properties,
        fetchProperties,
        loading,
        error
    } = useGetProperties();

    const {
        selectedPropertyId,
        selectProperty,
        property,
        refreshProperty
    } = useRealEstateBI();

    useEffect(() => {
        fetchProperties()
    }, [])

    return (
        // <div className="space-y-6 bg-slate-50 min-h-full flex ">
        //     <Aside
        //         properties={properties}
        //         loading={loading}
        //         error={error}
        //         selectedProperty={selectedPropertyId}
        //         setSelectedProperty={selectProperty}
        //         onPropertiesChanged={fetchProperties}
        //     />
        //     <MainStateBi
        //         property={property}
        //         onPropertyUpdate={() => {
        //             refreshProperty();
        //             fetchProperties();
        //         }}

        //     />
        // </div>

        <div className="bg-white min-h-screen flex overflow-auto">
            {/* ASIDE */}
            {asideOpen && (
                <Aside
                    open={asideOpen}
                    onToggle={() => setAsideOpen(prev => !prev)}
                    properties={properties}
                    loading={loading}
                    error={error}
                    selectedProperty={selectedPropertyId}
                    setSelectedProperty={selectProperty}
                    onPropertiesChanged={fetchProperties}
                />
            )}

            {/* MAIN */}
            <div className="flex-1 flex flex-col">
                {/* Botón toggle */}
                <div className="p-2">
                    <Button
                        variant="outline"
                        onClick={() => setAsideOpen(prev => !prev)}
                    >
                        {asideOpen ? "Ocultar menú" : "Mostrar menú"}
                    </Button>
                </div>

                <MainStateBi
                    property={property}
                    onPropertyUpdate={() => {
                        refreshProperty();
                        fetchProperties();
                    }}
                />
            </div>
        </div>
    );
}