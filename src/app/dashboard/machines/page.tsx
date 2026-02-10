"use client";

import React, { useState } from "react";
import { Badge, Button, DataTable, KPICard, ConfirmDialog } from "@/components/ui";
import {
  Cpu, Scan, AlertTriangle, Settings, Power,
  PowerOff, Wrench, CheckCircle2,
} from "lucide-react";

const mockMachines = [
  { id: "1", name: "VMM-1", type: "VMM" as const, status: "ACTIVE" as const, location: "Bay A - Station 1", inspections: 245, queueLength: 5, utilization: "87%" },
  { id: "2", name: "VMM-2", type: "VMM" as const, status: "ACTIVE" as const, location: "Bay A - Station 2", inspections: 198, queueLength: 3, utilization: "72%" },
  { id: "3", name: "VMM-3", type: "VMM" as const, status: "IDLE" as const, location: "Bay A - Station 3", inspections: 0, queueLength: 0, utilization: "0%" },
  { id: "4", name: "VMM-4", type: "VMM" as const, status: "MAINTENANCE" as const, location: "Bay A - Station 4", inspections: 0, queueLength: 0, utilization: "0%" },
  { id: "5", name: "VMM-5", type: "VMM" as const, status: "ACTIVE" as const, location: "Bay B - Station 1", inspections: 156, queueLength: 4, utilization: "65%" },
  { id: "6", name: "VMM-6", type: "VMM" as const, status: "ACTIVE" as const, location: "Bay B - Station 2", inspections: 289, queueLength: 6, utilization: "91%" },
  { id: "7", name: "CMM-1", type: "CMM" as const, status: "ACTIVE" as const, location: "Bay C - Station 1", inspections: 178, queueLength: 4, utilization: "78%" },
  { id: "8", name: "CMM-2", type: "CMM" as const, status: "ACTIVE" as const, location: "Bay C - Station 2", inspections: 218, queueLength: 3, utilization: "82%" },
  { id: "9", name: "CMM-3", type: "CMM" as const, status: "IDLE" as const, location: "Bay C - Station 3", inspections: 0, queueLength: 0, utilization: "0%" },
  { id: "10", name: "CMM-4", type: "CMM" as const, status: "SHUTDOWN" as const, location: "Bay C - Station 4", inspections: 0, queueLength: 0, utilization: "0%" },
];

const statusColors: Record<string, string> = {
  ACTIVE: "bg-success-500",
  IDLE: "bg-gray-400",
  MAINTENANCE: "bg-warning-500",
  SHUTDOWN: "bg-danger-500",
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "gray"> = {
  ACTIVE: "success",
  IDLE: "gray",
  MAINTENANCE: "warning",
  SHUTDOWN: "danger",
};

export default function MachinesPage() {
  const [filter, setFilter] = useState<"ALL" | "VMM" | "CMM">("ALL");
  const [shutdownDialog, setShutdownDialog] = useState<{ open: boolean; machineId: string | null }>({ open: false, machineId: null });

  const filtered = filter === "ALL" ? mockMachines : mockMachines.filter((m) => m.type === filter);
  const activeMachines = mockMachines.filter((m) => m.status === "ACTIVE").length;

  const columns = [
    {
      key: "name",
      header: "Machine",
      render: (item: (typeof mockMachines)[0]) => (
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-white ${
              item.type === "VMM"
                ? "bg-gradient-to-br from-primary-500 to-primary-700"
                : "bg-gradient-to-br from-navy-600 to-navy-800"
            }`}
          >
            {item.type === "VMM" ? <Scan size={16} /> : <Cpu size={16} />}
          </div>
          <div>
            <p className="font-black">{item.name}</p>
            <p className="text-xs text-gray-400">{item.location}</p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (item: (typeof mockMachines)[0]) => <Badge variant="info">{item.type}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      render: (item: (typeof mockMachines)[0]) => (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColors[item.status]}`} />
          <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
        </div>
      ),
    },
    { key: "queueLength", header: "Queue", render: (item: (typeof mockMachines)[0]) => <span className="font-bold">{item.queueLength}</span> },
    { key: "inspections", header: "Inspections", render: (item: (typeof mockMachines)[0]) => <span>{item.inspections}</span> },
    {
      key: "utilization",
      header: "Utilization",
      render: (item: (typeof mockMachines)[0]) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full" style={{ width: item.utilization }} />
          </div>
          <span className="text-xs font-bold">{item.utilization}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: (typeof mockMachines)[0]) => (
        <div className="flex gap-1">
          {item.status === "ACTIVE" && (
            <Button
              size="sm"
              variant="danger"
              icon={<PowerOff size={14} />}
              onClick={() => setShutdownDialog({ open: true, machineId: item.id })}
            >
              Shutdown
            </Button>
          )}
          {item.status === "SHUTDOWN" && (
            <Button size="sm" variant="success" icon={<Power size={14} />}>
              Activate
            </Button>
          )}
          {item.status === "MAINTENANCE" && (
            <Button size="sm" variant="outline" icon={<Wrench size={14} />}>
              Complete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white">
              <Settings size={22} />
            </div>
            Machines
          </h1>
          <p className="text-gray-500 mt-1 ml-13">Manage and monitor all inspection machines.</p>
        </div>
        <div className="flex gap-2">
          {(["ALL", "VMM", "CMM"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                filter === f
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Machines" value={String(mockMachines.length)} icon={<Cpu size={24} />} />
        <KPICard title="Active" value={String(activeMachines)} icon={<CheckCircle2 size={24} />} variant="highlight" />
        <KPICard title="Maintenance" value="1" icon={<Wrench size={24} />} />
        <KPICard title="Shutdown" value="1" icon={<AlertTriangle size={24} />} />
      </div>

      {/* Machine Table */}
      <DataTable columns={columns} data={filtered} />

      {/* Shutdown Confirm */}
      <ConfirmDialog
        isOpen={shutdownDialog.open}
        onClose={() => setShutdownDialog({ open: false, machineId: null })}
        onConfirm={() => setShutdownDialog({ open: false, machineId: null })}
        title="Shutdown Machine?"
        message="This will immediately stop the machine and move all queued items to other available machines."
        confirmText="Shutdown"
        variant="danger"
      />
    </div>
  );
}
