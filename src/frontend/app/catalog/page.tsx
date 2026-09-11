import { CatalogExplorer } from "@/components/catalog/catalog-explorer";
import { WorkspaceGuard } from "@/components/workspace/workspace-guard";

export default function CatalogPage() {
  return (
    <WorkspaceGuard>
      <CatalogExplorer />
    </WorkspaceGuard>
  );
}
