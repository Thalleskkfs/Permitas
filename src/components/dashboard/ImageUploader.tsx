import type { AdminImage } from "@/types/dashboard";
import { ImageIcon } from "./icons";

/**
 * Imagens do produto, somente leitura nesta etapa.
 *
 * Enviar não funciona e remover também não: apagar o metadado deixaria o arquivo órfão
 * no Storage, que ainda não está ligado. Em vez de simular, a área diz o que falta.
 */
export function ImageUploader({ initialImages }: { initialImages: AdminImage[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-6 py-10 text-center">
        <ImageIcon className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">Envio de imagens indisponível no momento</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Esta área exibe as imagens já cadastradas no produto. O envio e a remoção de
          arquivos estarão disponíveis em uma próxima versão.
        </p>
      </div>

      {initialImages.length === 0 ? (
        <p className="rounded-md border border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma imagem cadastrada para este produto.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {initialImages.map((image, index) => (
            <li key={image.id} className="flex flex-col gap-2">
              <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
                <div
                  role="img"
                  aria-label={image.alt}
                  className="flex size-full items-center justify-center text-muted-foreground"
                >
                  <ImageIcon className="size-7" />
                </div>
                {index === 0 && (
                  <span className="absolute left-2 top-2 rounded-sm bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    Principal
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{image.alt}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
