import type { MetadataRoute } from "next";

/**
 * `robots.txt` da vitrine. Libera a indexação da loja e aponta o sitemap; bloqueia só
 * o que nunca deveria aparecer numa busca — o painel (já tem `noindex` próprio, isso
 * aqui é a segunda trava) e as páginas de sessão do visitante (carrinho, busca), que não
 * são conteúdo de loja e só gerariam página duplicada ou vazia no índice do buscador.
 *
 * Sem `NEXT_PUBLIC_SITE_URL` (build local, sem deploy) o sitemap fica de fora: apontar
 * para uma URL que não existe é pior do que não apontar.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/carrinho", "/busca"],
    },
    ...(siteUrl ? { sitemap: `${siteUrl}/sitemap.xml` } : {}),
  };
}
