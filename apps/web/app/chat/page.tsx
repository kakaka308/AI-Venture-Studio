import ChatLayout from "@/components/chat/ChatLayout";
import { Suspense } from "react";

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <ChatLayout />
    </Suspense>
  );
}
