import { CategoryList } from "@/components/dashboard/CategoryList";
import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { canDeleteStructures } from "@/modules/catalog/authorization";
import { listCategoryTree } from "@/modules/catalog/queries";

export default async function CategoriasPage() {
  const store = await requireCurrentStore();
  const categories = await listCategoryTree(store.storeId);

  return (
    <DashboardContainer className="flex flex-col gap-6">
      <PageHeader
        title="Categorias"
        description="Organização hierárquica do catálogo. Subcategorias aparecem recuadas."
      />
      <CategoryList categories={categories} canDelete={canDeleteStructures(store.role)} />
    </DashboardContainer>
  );
}
