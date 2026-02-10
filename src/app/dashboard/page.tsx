"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { getDashboardPath } from "@/lib/rbac";
import { UserRole } from "@/types";
import { LoadingSpinner } from "@/components/ui";

export default function DashboardPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (session?.user?.role) {
    redirect(getDashboardPath(session.user.role as UserRole));
  }

  redirect("/login");
}
