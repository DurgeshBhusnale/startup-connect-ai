import { ComingSoon } from "@/components/app-shell/coming-soon";
import { BellIcon } from "@/components/icons";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <ComingSoon
      title="Notifications"
      body="New matches, intro requests, and meeting updates will show up here."
      icon={<BellIcon className="h-8 w-8" />}
    />
  );
}
