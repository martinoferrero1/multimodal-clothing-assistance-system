import { StyleBuilder } from "@/components/style/style-builder";
import { WorkspaceGuard } from "@/components/workspace/workspace-guard";

export default function StylePage() {
  return (
    <WorkspaceGuard>
      <StyleBuilder />
    </WorkspaceGuard>
  );
}
