import { CommunityDiscovery } from "@/components/community/community-discovery";
import { WorkspaceGuard } from "@/components/workspace/workspace-guard";

export default function CommunityPage() {
  return <WorkspaceGuard><CommunityDiscovery /></WorkspaceGuard>;
}
