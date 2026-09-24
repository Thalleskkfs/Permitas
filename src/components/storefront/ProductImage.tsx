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
  // Quadrado é o formato padrão (galeria, carrinho). Quem precisa de outra proporção,
  // como o card em retrato 2:3, manda a sua própria classe `aspect-*`: duas proporções
  // na mesma lista de classes brigariam pela ordem do CSS, então a padrão sai de cena.
  const proporcao = className?.includes("aspect-") ? "" : "aspect-square";

  return (
    <div
      className={`relative overflow-hidden bg-muted text-muted-foreground ${proporcao} ${className ?? ""}`}
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
