// SliderGalleryProperty.jsx
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { useRef } from "react";

export default function SliderGalleryProperty({ listImages }) {
  const swiperRef = useRef(null);

  if (!listImages || listImages.length === 0) return null;

  return (
    <div className="relative w-full h-full flex justify-center items-center">
      {/* Swiper */}
      <Swiper
        modules={[Navigation, Pagination]}
        spaceBetween={10}
        slidesPerView={1}
        pagination={{ clickable: true }}
        onBeforeInit={(swiper) => {
          swiperRef.current = swiper;
        }}
        className="w-full h-full"
      >
        {listImages.map((image, idx) => (
          <SwiperSlide
            key={idx}
            className="flex justify-center items-center"
          >
            <img
              src={image.url}
              alt={`Imagen ${idx + 1}`}
              className="max-h-[85vh] w-auto object-contain rounded-lg select-none m-auto"
              loading="lazy"
            />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Botón anterior */}
      <button
        onClick={() => swiperRef.current?.slidePrev()}
        className="hidden md:flex absolute z-10 left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full transition duration-200 cursor-pointer"
      >
        {/* Aquí puedes usar un ícono SVG propio o de librería */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-chevron-left">
          <path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M15 6l-6 6l6 6" />
        </svg>
      </button>

      {/* Botón siguiente */}
      <button
        onClick={() => swiperRef.current?.slideNext()}
        className="hidden md:flex absolute z-10 right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full transition duration-200 cursor-pointer"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          class="icon icon-tabler icons-tabler-outline icon-tabler-chevron-right">
          <path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M9 6l6 6l-6 6" />
        </svg>
      </button>
    </div>
  );
}
