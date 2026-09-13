import { ComingSoon } from "@/components/app-shell/coming-soon";
import { UserIcon } from "@/components/icons";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Profile" };

export default function ProfilePage() {
  return (
    <ComingSoon
      title="My Profile"
      body="Build and edit your profile here — it’s what powers every match."
      icon={<UserIcon className="h-8 w-8" />}
    />
  );
}
