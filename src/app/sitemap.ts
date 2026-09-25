import type { MetadataRoute } from "next";
import { getCurrentStoreSlug } from "@/lib/current-store-slug";
import { storefrontPaths } from "@/lib/storefront-paths";
import { INSTITUTIONAL_PAGES, PROVISIONAL } from "@/modules/storefront/institutional";
import { getAllProducts, getCategories } from "@/modules/storefront/queries";

/** Todos os produtos publicados cabem numa página só enquanto a loja for deste tamanho. */
const TODOS_OS_PRODUTOS = 1000;

/**
 * `sitemap.xml`: home, categorias e produtos publicados — o que o buscador deve mesmo
 * indexar. As páginas institucionais ficam de fora enquanto o texto for provisório
 * (`PROVISIONAL`): elas já saem com `noindex` própria, e um sitemap que lista página
 * bloqueada é o tipo de contradição que o Search Console aponta como erro.
 *
 * Sem `NEXT_PUBLIC_SITE_URL` (build local) devolve uma lista vazia: não há como montar
 * URL absoluta sem ela, e um sitemap com link relativo não serve para nada.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (!siteUrl) return [];

  const storeSlug = getCurrentStoreSlug();
  const paths = storefrontPaths();
  const absoluta = (caminho: string) => `${siteUrl}${caminho}`;

  const [categorias, produtos] = await Promise.all([
    getCategories(storeSlug),
    getAllProducts(storeSlug, { offset: 0, limit: TODOS_OS_PRODUTOS }),
  ]);

  return [
    { url: absoluta(paths.home), changeFrequency: "daily", priority: 1 },
    { url: absoluta(paths.allProducts), changeFrequency: "daily", priority: 0.9 },
    ...categorias.map((categoria) => ({
      url: absoluta(paths.category(categoria.slug)),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...produtos.products.map((produto) => ({
      url: absoluta(produto.href),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...(PROVISIONAL
      ? []
      : INSTITUTIONAL_PAGES.map((pagina) => ({
          url: absoluta(paths.institutional(pagina.slug)),
          changeFrequency: "yearly" as const,
          priority: 0.3,
        }))),
  ];
}
