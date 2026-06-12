import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat - AI Venture Studio",
  description: "Chat with AI to build your venture",
};

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
