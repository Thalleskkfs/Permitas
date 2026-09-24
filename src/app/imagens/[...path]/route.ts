import { readPublicImage } from "@/lib/storage/catalog-images";

/**
 * Serve as imagens do catálogo a partir do bucket privado.
 *
 * O bucket continua sem nenhuma policy pública: quem decide o que sai é
 * `readPublicImage`, que só entrega arquivo referenciado por uma linha visível ao
 * visitante (foto de produto publicado, banner ativo, sempre de loja ativa). Fica fora
 * de /loja de propósito, sem o portão de idade: o aparelho que monta o cartão de prévia
 * do WhatsApp busca a imagem sem cookie nenhum.
 *
 * Os nomes de arquivo são UUIDs gerados no upload, então o conteúdo de um endereço nunca
 * muda — daí o cache longo. Não é `immutable` porque um produto despublicado deve deixar
 * de ter a foto servida; um dia de cache é o teto dessa defasagem.
 */
export async function GET(_request: Request, { params }: RouteContext<"/imagens/[...path]">) {
  const { path } = await params;
  const image = await readPublicImage(path.join("/"));

  if (!image) {
    return new Response("Imagem não encontrada.", {
      status: 404,
      headers: { "Cache-Control": "public, max-age=60", "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(image.body, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      // O tipo vem da extensão validada; o navegador não deve tentar adivinhar outro.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
