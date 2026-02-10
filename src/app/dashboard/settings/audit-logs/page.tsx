"use client";

import React, { useState } from "react";
import { DataTable } from "@/components/ui";

// ============================================================
// Mock Data
// ============================================================

interface AuditLogEntry {
  no: number;
  details: string;
  time: string;
  date: string;
  accountName: string;
}

const mockAuditLogs: AuditLogEntry[] = [
  {
    no: 1,
    details: "User 1 promoted to Admin",
    time: "13:24:23",
    date: "Jan 23, 2026",
    accountName: "Engr. Juan Dela Cruz",
  },
  { no: 2, details: "", time: "", date: "", accountName: "" },
  { no: 3, details: "", time: "", date: "", accountName: "" },
  { no: 4, details: "", time: "", date: "", accountName: "" },
  { no: 5, details: "", time: "", date: "", accountName: "" },
  { no: 6, details: "", time: "", date: "", accountName: "" },
  { no: 7, details: "", time: "", date: "", accountName: "" },
];

// ============================================================
// Audit Logs Page
// ============================================================

export default function AuditLogsPage() {
  const [logs] = useState<AuditLogEntry[]>(mockAuditLogs);

  const columns = [
    {
      key: "no",
      header: "No.",
      className: "w-16 font-bold",
    },
    {
      key: "details",
      header: "Details",
      className: "min-w-[250px]",
    },
    {
      key: "time",
      header: "Time",
      className: "w-28",
    },
    {
      key: "date",
      header: "Date",
      className: "w-36",
      render: (item: AuditLogEntry) =>
        item.date ? (
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
            {item.date}
          </span>
        ) : null,
    },
    {
      key: "accountName",
      header: "Account Name",
      className: "min-w-[200px]",
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
