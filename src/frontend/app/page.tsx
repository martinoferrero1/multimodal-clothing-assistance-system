import { HomeDashboard } from "@/components/home/home-dashboard";
import { WorkspaceGuard } from "@/components/workspace/workspace-guard";

export default function HomePage() {
  return (
    <WorkspaceGuard>
      <HomeDashboard />
    </WorkspaceGuard>
  );
}
