import { WorkspaceGuard } from "@/components/workspace/workspace-guard";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceGuard>{children}</WorkspaceGuard>;
}
