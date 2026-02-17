"use client";

import React, { useState, useEffect } from "react";
import { DataTable, LoadingSpinner } from "@/components/ui";

// ============================================================
// Types
// ============================================================

interface AuditLogEntry {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  user: {
    name: string;
    accountId: string;
  };
}

// ============================================================
// Audit Logs Page
// ============================================================

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/audit-logs?limit=100");
      const data = await response.json();
      setLogs(data.data || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const columns = [
    {
      key: "action",
      header: "Action",
      className: "w-48 font-bold",
    },
    {
      key: "details",
      header: "Details",
      className: "min-w-[250px]",
    },
    {
      key: "createdAt",
      header: "Date & Time",
      className: "w-44",
      render: (item: AuditLogEntry) => (
        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
          {new Date(item.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "user",
      header: "User",
      className: "min-w-[200px]",
      render: (item: AuditLogEntry) => `${item.user.name} (${item.user.accountId})`,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 mb-6">
        Audit Logs
      </h1>
      <DataTable columns={columns} data={logs} />
    </div>
  );
}
