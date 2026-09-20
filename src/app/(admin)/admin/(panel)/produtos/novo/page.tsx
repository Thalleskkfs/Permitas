import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ProductForm } from "@/components/dashboard/ProductForm";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { listCategoryTree, listCollections, listTags } from "@/modules/catalog/queries";

export default async function NovoProdutoPage() {
  const store = await requireCurrentStore();

  const [categories, tags, collections] = await Promise.all([
    listCategoryTree(store.storeId),
    listTags(store.storeId),
    listCollections(store.storeId),
  ]);

  return (
    <DashboardContainer className="flex flex-col gap-8">
      <PageHeader
        title="Novo produto"
        description="As variantes podem ser adicionadas depois que o produto for criado."
      />
      <ProductForm categories={categories} tags={tags} collections={collections} />
    </DashboardContainer>
  );
}
