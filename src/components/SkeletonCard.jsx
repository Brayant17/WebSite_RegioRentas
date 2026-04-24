export default function SkeletonCard() {
    return (
        <div className="animate-pulse bg-white rounded-lg shadow-md overflow-hidden">
            <div className="h-40 bg-gray-200" /> {/* Imagen */}
            <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" /> {/* Título */}
                <div className="h-3 bg-gray-200 rounded w-1/2" /> {/* Precio */}
                <div className="h-3 bg-gray-200 rounded w-full" /> {/* Dirección */}
            </div>
        </div>
    );
}
