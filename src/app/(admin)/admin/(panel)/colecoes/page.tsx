import { CollectionList } from "@/components/dashboard/CollectionList";
import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { canDeleteStructures } from "@/modules/catalog/authorization";
import { listCollections } from "@/modules/catalog/queries";

export default async function ColecoesPage() {
  const store = await requireCurrentStore();
  const collections = await listCollections(store.storeId);

  return (
    <DashboardContainer className="flex flex-col gap-6">
      <PageHeader
        title="Coleções"
        description="Curadorias manuais com ordem própria, exibidas na loja."
      />
      <CollectionList collections={collections} canDelete={canDeleteStructures(store.role)} />
    </DashboardContainer>
  );
}
