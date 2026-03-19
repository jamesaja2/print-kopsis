"use client";

import { useEffect, useState } from "react";

type PromoSlide = {
  key: string;
  link?: string;
  url: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
};

export default function UserPromoCarousel() {
  const [slides, setSlides] = useState<PromoSlide[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const loadSlides = async () => {
      try {
        const res = await fetch("/api/print/promo-slider", { cache: "no-store" });
        const json = (await res.json()) as ApiResponse<PromoSlide[]>;
        if (!res.ok || !json.success) return;
        const cleanSlides = (json.data || []).filter((item) => item.url);
        setSlides(cleanSlides);
        setIndex(0);
      } catch {
        // Keep dashboard usable when promo API fails.
      }
    };

    void loadSlides();
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [slides]);

  if (slides.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">
        Belum ada banner promo
      </div>
    );
  }

  const current = slides[index];

  return (
    <div className="relative">
      <button
        type="button"
        className="group block w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
        onClick={() => {
          if (current?.link) {
            window.open(current.link, "_blank", "noopener,noreferrer");
          }
        }}
        title={current?.link ? "Open promo link" : "Promo"}
      >
        <img
          src={current.url}
          alt="Promo slider"
          className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        />
      </button>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/85 p-2 text-gray-700 shadow hover:bg-white"
            onClick={() => setIndex((prev) => (prev - 1 + slides.length) % slides.length)}
            aria-label="Previous slide"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 6L9 12L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/85 p-2 text-gray-700 shadow hover:bg-white"
            onClick={() => setIndex((prev) => (prev + 1) % slides.length)}
            aria-label="Next slide"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      ) : null}
    </div>
  );
}
