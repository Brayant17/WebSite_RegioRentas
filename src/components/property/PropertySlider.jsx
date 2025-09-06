import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
// import "swiper/css/lazy";

export default function PropertySlider({ images, name }) {
    return (
        <Swiper
            modules={[Navigation, Pagination]}
            navigation={{
                nextEl: ".btn-next",
                prevEl: ".btn-prev",
            }}
            pagination={{ clickable: true }}
            // preloadImages={false}
            spaceBetween={8}
            slidesPerView={1}
            style={{ width: "100%", height: "100%" }}
            className="group"
        >
            {images.map((src, idx) => (
                <SwiperSlide key={idx} className="overflow-hidden rounded-xl">
                    <img
                        src={src}
                        className="swiper-lazy w-full h-full object-cover"
                        alt={`${name} - imagen ${idx + 1}`}
                        loading={"lazy"}
                    />
                    <div className="swiper-lazy-preloader"></div>
                </SwiperSlide>
            ))}
            <button className="btn-prev absolute left-2 top-1/2 -translate-y-1/2 bg-white text-neutral-700 rounded-full w-10 h-10 flex items-center justify-center z-10 md:hidden group-hover:flex cursor-pointer">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-left"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M15 6l-6 6l6 6" /></svg>
            </button>
            <button className="btn-next absolute right-2 top-1/2 -translate-y-1/2 bg-white text-neutral-700 rounded-full w-10 h-10 flex items-center justify-center z-10 md:hidden group-hover:flex cursor-pointer">
                <svg width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6" /></svg>
            </button>
        </Swiper>
    );
}