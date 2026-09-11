import { FavoritesView } from "@/components/favorites/favorites-view";
import { WorkspaceGuard } from "@/components/workspace/workspace-guard";

export default function FavoritesPage() {
  return (
    <WorkspaceGuard>
      <FavoritesView />
    </WorkspaceGuard>
  );
}
