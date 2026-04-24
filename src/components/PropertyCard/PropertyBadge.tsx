import BadgeVerified from "@/assets/badge_17460216.png";
import type { Property } from "@/types/property";

export default function PropertyBadges({ property }: { property: Property;}) {
    return (
        <>
            {property.users?.is_verified && (
                <div className="absolute top-3 left-3 z-10 bg-white text-neutral-800 text-xs font-semibold px-1 py-0.5 rounded-xl flex items-center gap-1">
                    <img src={BadgeVerified.src} alt="Verificado" className="w-6 h-6" />
                    <span className="text-xs font-medium pr-1">Verificado</span>
                </div>
            )}
        </>
    );
}
