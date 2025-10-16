// React Component
import PropertySlider from "./PropertySlider.jsx"

function PropertyCard({ id, property, slug }) {

    const priceNormalized = property.price.toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 0,
    });

    return (
        <article className="rounded-lg w-full">
            <div className="w-full aspect-[4/3] sm:aspect-[3/2] rounded-xl overflow-hidden">
                <a href={`propiedad/${slug}`}>
                    <PropertySlider client:visible images={property.images} name="test" />
                </a>
            </div>
            <div className="py-1.5 px-4">
                <span className="font-normal text-slate-700 font-display text-sm">{property.title}</span>
                <p className="font-bold text-slate-700">{property.municipio} {property.colonia}</p>
                <span className="font-bold text-slate-700">{priceNormalized} MXN</span>
            </div>
        </article>
    )
}


export { PropertyCard }