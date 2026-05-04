import { ConversationProvider } from "@/components/providers/conversation-provider";
import { WorkspaceGuard } from "@/components/workspace/workspace-guard";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConversationProvider>
      <WorkspaceGuard>
        <WorkspaceShell>{children}</WorkspaceShell>
      </WorkspaceGuard>
    </ConversationProvider>
  );
}
