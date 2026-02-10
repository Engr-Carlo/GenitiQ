"use client";

import React from "react";
import { SettingsSidebar } from "@/components/layout";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-6">
      <SettingsSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
