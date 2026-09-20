import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { TagList } from "@/components/dashboard/TagList";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { canDeleteStructures } from "@/modules/catalog/authorization";
import { listTags } from "@/modules/catalog/queries";

export default async function TagsPage() {
  const store = await requireCurrentStore();
  const tags = await listTags(store.storeId);

  return (
    <DashboardContainer className="flex flex-col gap-6">
      <PageHeader
        title="Tags"
        description="Agrupamentos livres. A associação a produtos é feita na tela do produto."
      />
      <TagList tags={tags} canDelete={canDeleteStructures(store.role)} />
    </DashboardContainer>
  );
}
