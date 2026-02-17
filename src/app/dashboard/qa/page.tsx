"use client";

import { redirect } from "next/navigation";
import { useEffect } from "react";

// ============================================================
// QA Dashboard - Redirects to Inspector Dashboard
// QA/QC role has been merged with Inspector role
// ============================================================

export default function QADashboardPage() {
  useEffect(() => {
    // Redirect to inspector dashboard since roles are merged
    redirect("/dashboard/inspector");
  }, []);

  return null;
}
