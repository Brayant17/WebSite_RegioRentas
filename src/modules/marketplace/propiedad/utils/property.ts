// src/utils/property.ts
export function formatPrice(price: number) {
    return price.toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 0,
    });
}

export function getFirstImages(images: PropertyImage[] = []) {
    return images.map(img => img.url).slice(0, 5);
}

export function buildWhatsappMessage(title: string) {
    return encodeURIComponent(
        `Hola 👋, vi tu publicación sobre "${title}". ¿Sigue disponible?`
    );
}
