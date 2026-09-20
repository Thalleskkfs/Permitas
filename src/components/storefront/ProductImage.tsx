import Image from "next/image";
import type { ProductImage as ProductImageData } from "@/types/catalog";
import { ImageIcon } from "./icons";

type ProductImageProps = {
  image?: ProductImageData;
  sizes: string;
  priority?: boolean;
  className?: string;
};

export function ProductImage({ image, sizes, priority, className }: ProductImageProps) {
  return (
    <div
      className={`relative aspect-square overflow-hidden bg-muted text-muted-foreground ${className ?? ""}`}
    >
      {image?.src ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={image?.alt ?? "Imagem indisponível"}
          className="flex size-full items-center justify-center"
        >
          <ImageIcon className="size-8" />
        </div>
      )}
    </div>
  );
}
