"use client";

import React, { useState } from "react";
import { DataTable, Select } from "@/components/ui";

// ============================================================
// Mock Data
// ============================================================

interface MachineReportEntry {
  no: number;
  reportBy: string;
  time: string;
  date: string;
  reasons: string;
  status: string;
}

const mockReports: MachineReportEntry[] = [
  {
    no: 1,
    reportBy: "Juan Dela Cruz",
    time: "13:24:23",
    date: "Jan 23, 2026",
    reasons: "Machine Shutdown",
    status: "Stopped",
  },
  { no: 2, reportBy: "", time: "", date: "", reasons: "", status: "" },
  { no: 3, reportBy: "", time: "", date: "", reasons: "", status: "" },
  { no: 4, reportBy: "", time: "", date: "", reasons: "", status: "" },
  { no: 5, reportBy: "", time: "", date: "", reasons: "", status: "" },
  { no: 6, reportBy: "", time: "", date: "", reasons: "", status: "" },
  { no: 7, reportBy: "", time: "", date: "", reasons: "", status: "" },
];

const machineOptions = [
  { value: "vmm-1", label: "VMM MACHINE 1" },
  { value: "vmm-2", label: "VMM MACHINE 2" },
  { value: "vmm-3", label: "VMM MACHINE 3" },
  { value: "cmm-1", label: "CMM MACHINE 1" },
  { value: "cmm-2", label: "CMM MACHINE 2" },
  { value: "cmm-3", label: "CMM MACHINE 3" },
];

// ============================================================
// Machine Reports Page
// ============================================================

export default function MachineReportsPage() {
  const [selectedMachine, setSelectedMachine] = useState("vmm-1");
  const [reports] = useState<MachineReportEntry[]>(mockReports);

  const columns = [
    {
      key: "no",
      header: "#",
      className: "w-12 font-bold",
    },
    {
      key: "reportBy",
      header: "Report by",
      className: "min-w-[180px]",
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
      render: (item: MachineReportEntry) =>
        item.date ? (
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
            {item.date}
          </span>
        ) : null,
    },
    {
      key: "reasons",
      header: "Reason/s",
      className: "min-w-[150px]",
    },
    {
      key: "status",
      header: "Status",
      className: "w-28",
      render: (item: MachineReportEntry) =>
        item.status ? (
          <span className="text-danger-600 font-bold text-sm">{item.status}</span>
        ) : null,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 mb-4">
        Machine Reports
      </h1>

      <div className="mb-6 max-w-xs">
        <Select
          options={machineOptions}
          value={selectedMachine}
          onChange={(e) => setSelectedMachine(e.target.value)}
          className="font-bold text-primary-900"
        />
      </div>

      <DataTable columns={columns} data={reports} />
    </div>
  );
}
