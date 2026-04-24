// utilidades
import { useProperty } from "./hooks/useProperty";

// Componentes
import TitleSlug from "./components/TitleSlug";
import Description from "./components/Description";
import TypePropertyOperation from "./components/TypePropertyOperation"
import Features from "./components/Features";
import PhysicalState from "./components/PhysicalState";
import Services from "./components/Services";
import Location from "./components/Location";
import Amenities from "./components/Amenities";
import DropZone from "./components/DropZone";
import PublishingOptions from "./components/PublishingOptions";
import { Toaster } from "@/components/ui/sonner";


type Props = {
    propertyId: string | null; // Puede ser null para creación o un string para edición
}

export default function NewProperty({ propertyId }: Props) {
    const {
        propertyData,
        setPropertyData,
        files,
        setFiles,
        loading,
        save
    } = useProperty(propertyId);

    if (loading) return <p>Cargando propiedad</p>

    return (
        <div className="flex flex-col gap-4 md:gap-0 md:flex-row">
            <Toaster />
            <div className="flex flex-col gap-10 flex-4/5 border border-slate-200 rounded p-4">
                <div className="flex flex-col gap-1.5">
                    <TitleSlug title={propertyData.title} slug={propertyData.slug} setterState={setPropertyData} />
                </div>
                <div>
                    <Description description={propertyData.description} setterState={setPropertyData} />
                </div>

                <div>
                    <h4 className="font-semibold">Tipo y Características</h4>
                    <div className="flex flex-wrap w-full justify-between">
                        <TypePropertyOperation propertyType={propertyData.property_type} operation={propertyData.operation} setterState={setPropertyData} />
                        <PhysicalState furnished={propertyData.furnished} setterState={setPropertyData} />
                    </div>
                    <div className="flex w-full">
                        <Features price={propertyData.price} area={propertyData.area} floors={propertyData.floors} bedrooms={propertyData.bedrooms} bathrooms={propertyData.bathrooms} parking={propertyData.parking} setterState={setPropertyData} />
                    </div>
                </div>

                <div>
                    <h4 className="font-semibold">Ubicación</h4>
                    <Location estado={propertyData.estado} municipio={propertyData.municipio} colonia={propertyData.colonia} zona={propertyData.zona} setterState={setPropertyData} />
                </div>

                <div className="w-full">
                    <h4 className="font-semibold">Servicios</h4>
                    <Services servicesChecked={propertyData.services} setterState={setPropertyData} />
                </div>
                <div className="w-full">
                    <h4 className="font-semibold">Amenidades</h4>
                    <Amenities amenitiesChecked={propertyData.amenities} setterState={setPropertyData} />
                </div>

                <div className="w-full">
                    <h4 className="font-semibold">Multimedia</h4>
                    <span className="inline-block my-1.5 text-sm text-neutral-800 font-semibold">Imagenes de la propiedad</span>
                    <DropZone
                        files={files}
                        setFiles={setFiles}
                    />
                </div>
            </div>
            {/* Panel derecho */}
            <PublishingOptions
                propertyData={propertyData}
                setPropertyData={setPropertyData}
                save={save}
            />
        </div>
    );
}
