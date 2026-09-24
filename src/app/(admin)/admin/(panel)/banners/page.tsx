import { BannerManager, type DestinoDoBanner } from "@/components/dashboard/BannerManager";
import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { storefrontPaths } from "@/lib/storefront-paths";
import { loadBannersForPanel } from "@/modules/banners/actions";
import { canDeleteStructures } from "@/modules/catalog/authorization";
import { listCategories } from "@/modules/catalog/queries";

export default async function BannersPage() {
  // A loja vem da membership autenticada; nenhum id chega pela URL ou pelo formulário.
  const store = await requireCurrentStore();
  const [banners, categories] = await Promise.all([loadBannersForPanel(), listCategories(store.storeId)]);

  const paths = storefrontPaths();
  const destinos: DestinoDoBanner[] = [
    { value: "", label: "Sem link" },
    { value: paths.allProducts, label: "Todos os produtos" },
    ...categories
      .filter((category) => category.active)
      .map((category) => ({ value: paths.category(category.slug), label: category.name })),
  ];

  // Um banner pode apontar para uma categoria desativada depois de criado. Sem essa
  // opção "extra" na lista, o <select> não acharia o valor atual e cairia na primeira
  // opção ("Sem link") sem avisar — e salvar qualquer outro campo apagaria o link.
  const valoresConhecidos = new Set(destinos.map((option) => option.value));
  const nomePorHref = new Map(categories.map((category) => [paths.category(category.slug), category.name]));
  const destinosDesativados = [...new Set(banners.map((banner) => banner.href).filter(Boolean))]
    .filter((href) => !valoresConhecidos.has(href))
    .map((href) => ({
      value: href,
      label: nomePorHref.has(href) ? `${nomePorHref.get(href)} (inativa)` : "Link atual (categoria removida)",
    }));
  destinos.push(...destinosDesativados);

  return (
    <DashboardContainer className="flex flex-col gap-8">
      <PageHeader
        title="Banners"
        description="Os banners que giram no topo da página inicial da loja, na ordem desta lista."
      />
      <BannerManager banners={banners} destinos={destinos} canDelete={canDeleteStructures(store.role)} />
    </DashboardContainer>
  );
}
