import PropertySlider from "./PropertySlider.jsx";
import FavoriteButton from "./FavoriteButton.jsx";

function PropertyCard({ id, property, slug, isFavorite, session, badge }) {
    const dominio = window.location.origin;
    const priceNormalized = property.price.toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 0,
    });

    return (
        <article className="rounded-lg w-full overflow-hidden cursor-pointer">
            {/* Imagen / Slider */}
            <div className="relative w-full aspect-[4/3] sm:aspect-[3/2] flex items-center justify-center">
                <a href={`${dominio}/propiedad/${slug}`} className="block w-full h-full">
                    {property.images && property.images.length > 0 ? (
                        <PropertySlider client:visible images={property.images} name={property.title} />
                    ) : (
                        <span className="text-slate-400 text-sm">Sin imagen</span>
                    )}
                </a>

                {/* Botón de favorito */}
                <div className="absolute top-0.5 right-0.5 z-10">
                    <FavoriteButton propertyId={id} isInitiallyFavorite={isFavorite} session={session} />
                </div>

                {/* Badge opcional */}
                {badge && (
                    <div className="absolute top-3 left-3 z-10 bg-red-600 text-white text-xs font-semibold px-2 py-0.5 rounded">
                        {badge}
                    </div>
                )}
            </div>

            {/* Contenido */}
            <div className="py-3 flex flex-col gap-1">
                {/* Título y tipo */}
                <div className="flex justify-between items-start">
                    <h3 className="text-sm font-semibold text-black truncate">{property.title}</h3>
                    <span className="text-xs font-medium text-gray-600">{property.property_type || "Departamento"}</span>
                </div>

                {/* Ubicación */}
                <p className="text-xs text-gray-500 truncate">{property.municipio} • {property.colonia}</p>

                {/* Precio */}
                <div className="flex items-center gap-2">
                    <p className="font-bold text-md truncate">{priceNormalized}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${property.operation === "Renta" ? "bg-red-50 text-red-600 border border-red-100" : "bg-neutral-900 text-white"}`}>
                        {property.operation}
                    </span>
                </div>

                <div className="flex justify-between items-start">

                    {/* Detalles rápidos compactos */}
                    <div className="flex items-center gap-3 text-xs text-gray-600 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="icon-tabler">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path d="M7 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
                                <path d="M22 17v-3h-20" />
                                <path d="M2 8v9" />
                                <path d="M12 14h10v-2a3 3 0 0 0 -3 -3h-7v5z" />
                            </svg>
                            {property.bedrooms || 2}
                        </span>

                        <span className="mx-1">•</span>

                        <span className="flex items-center gap-1">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="icon-tabler">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4v-3a1 1 0 0 1 1 -1z" />
                                <path d="M6 12v-7a2 2 0 0 1 2 -2h3v2.25" />
                                <path d="M4 21l1 -1.5" />
                                <path d="M20 21l-1 -1.5" />
                            </svg>
                            {property.bathrooms || 1}
                        </span>

                        <span className="mx-1">•</span>

                        <span className="flex items-center gap-1">
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="icon-tabler">
                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                <path d="M5 4h14a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-7a1 1 0 0 0 -1 1v7a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1" />
                                <path d="M4 8l2 0" />
                                <path d="M4 12l3 0" />
                                <path d="M4 16l2 0" />
                                <path d="M8 4l0 2" />
                                <path d="M12 4l0 3" />
                                <path d="M16 4l0 2" />
                            </svg>
                            {property.area || 0} m²
                        </span>
                    </div>
                </div>
            </div>
        </article>
    );
}

export { PropertyCard };
