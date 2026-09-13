import { ComingSoon } from "@/components/app-shell/coming-soon";
import { SettingsIcon } from "@/components/icons";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      body="Manage your account, notification preferences, and privacy choices here."
      icon={<SettingsIcon className="h-8 w-8" />}
    />
  );
}
