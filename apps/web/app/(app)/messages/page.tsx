import { ComingSoon } from "@/components/app-shell/coming-soon";
import { MessageSquareIcon } from "@/components/icons";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <ComingSoon
      title="Messages"
      body="Conversations with your accepted matches will live here."
      icon={<MessageSquareIcon className="h-8 w-8" />}
    />
  );
}
