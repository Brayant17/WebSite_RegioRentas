import { Download, X } from "lucide-react";

type Props = {
    lightboxUrl: string;
    setLightboxUrl: (param: string | null)=>void;
}

export function LightboxUrl({ lightboxUrl, setLightboxUrl }: Props) {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6"
            onClick={() => setLightboxUrl(null)}
        >
            <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Cerrar"
            >
                <X className="h-5 w-5" />
            </button>
            <a
                href={lightboxUrl}
                download
                onClick={(e) => e.stopPropagation()}
                className="absolute right-16 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Descargar"
            >
                <Download className="h-5 w-5" />
            </a>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={lightboxUrl}
                alt="Documento"
                className="max-h-full max-w-full rounded-md object-contain"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
    )
}