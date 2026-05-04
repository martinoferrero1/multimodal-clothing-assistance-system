import { ChatWorkspace } from "@/components/chat/chat-workspace";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return <ChatWorkspace conversationId={conversationId} />;
}
