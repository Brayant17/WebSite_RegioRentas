import { useEffect, useState } from "react";
import Aside from "./components/aside/Aside";
import MainStateBi from "./components/MainStateBi/MainStateBi";
import { useRealEstateBI } from "./hooks/propiedades/useRealEstateBI";
import { useGetProperties } from "./hooks/propiedades/useGetProperties";

export default function RealEstateBIDashboard() {

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

    useEffect(()=>{
        fetchProperties()
    }, [])

    return (
        <div className="space-y-6 bg-slate-50 min-h-full flex ">
            <Aside
                properties={properties}
                loading={loading}
                error={error}
                selectedProperty={selectedPropertyId}
                setSelectedProperty={selectProperty}
                onPropertiesChanged={fetchProperties}
            />
            <MainStateBi
                property={property}
                onPropertyUpdate={() => {
                    refreshProperty();
                    fetchProperties();
                }}

            />
        </div>
    );
}