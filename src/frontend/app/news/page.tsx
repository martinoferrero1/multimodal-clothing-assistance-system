import { FashionNews } from "@/components/news/fashion-news";
import { WorkspaceGuard } from "@/components/workspace/workspace-guard";

export default function NewsPage() {
  return (
    <WorkspaceGuard>
      <FashionNews />
    </WorkspaceGuard>
  );
}
