"use client";

import { useState } from "react";
import type { ProductImage as ProductImageData } from "@/types/catalog";
import { ProductImage } from "./ProductImage";

export function ProductGallery({ images }: { images: ProductImageData[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  return (
    <div className="flex flex-col gap-3">
      <ProductImage
        image={active}
        sizes="(min-width: 1024px) 50vw, 100vw"
        priority
        className="rounded-md border border-border"
      />

      {images.length > 1 && (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {images.map((image, index) => (
            <li key={`${image.alt}-${index}`}>
              <button
                type="button"
                aria-label={`Ver imagem ${index + 1} de ${images.length}`}
                aria-pressed={index === activeIndex}
                onClick={() => setActiveIndex(index)}
                className={`focus-ring block w-full overflow-hidden rounded-md border ${
                  index === activeIndex
                    ? "border-primary"
                    : "border-border opacity-70 hover:opacity-100"
                }`}
              >
                <ProductImage image={image} sizes="120px" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
