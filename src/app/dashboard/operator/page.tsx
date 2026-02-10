"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, Button, Badge, KPICard, ConfirmDialog, StatusIndicator } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  Cpu, Power, Pause, AlertTriangle,
  Wrench, Activity, Clock, CheckCircle2, XCircle,
} from "lucide-react";

// ============================================================
// Mock Data
// ============================================================

interface MachineData {
  id: string;
  name: string;
  type: "VMM" | "CMM";
  number: number;
  status: "ACTIVE" | "IDLE" | "MAINTENANCE" | "SHUTDOWN";
  currentPart?: string;
  uptime: string;
  inspectionsToday: number;
}

const mockMachines: MachineData[] = [
  { id: "1", name: "VMM Machine 1", type: "VMM", number: 1, status: "IDLE", uptime: "98.5%", inspectionsToday: 12 },
  { id: "2", name: "VMM Machine 2", type: "VMM", number: 2, status: "ACTIVE", currentPart: "PN1001", uptime: "96.2%", inspectionsToday: 10 },
  { id: "3", name: "VMM Machine 3", type: "VMM", number: 3, status: "SHUTDOWN", uptime: "0%", inspectionsToday: 0 },
  { id: "4", name: "CMM Machine 1", type: "CMM", number: 1, status: "IDLE", uptime: "99.1%", inspectionsToday: 15 },
  { id: "5", name: "CMM Machine 2", type: "CMM", number: 2, status: "ACTIVE", uptime: "87.3%", inspectionsToday: 7 },
  { id: "6", name: "CMM Machine 3", type: "CMM", number: 3, status: "MAINTENANCE", uptime: "0%", inspectionsToday: 0 },
];

const mockAlerts = [
  { id: "1", message: "VMM Machine 3 - Emergency shutdown requested by Inspector", time: "2 min ago", severity: "critical" },
  { id: "2", message: "CMM Machine 2 - Paused for calibration", time: "15 min ago", severity: "warning" },
  { id: "3", message: "CMM Machine 3 - Scheduled maintenance", time: "1 hour ago", severity: "info" },
];

// ============================================================
// Status Colors
// ============================================================

const statusColors: Record<string, string> = {
  ACTIVE: "bg-primary-100 border-primary-300 text-primary-700",
  IDLE: "bg-success-100 border-success-300 text-success-700",
  MAINTENANCE: "bg-warning-100 border-warning-300 text-warning-700",
  SHUTDOWN: "bg-danger-100 border-danger-300 text-danger-700",
};

const statusBg: Record<string, string> = {
  ACTIVE: "from-primary-50 to-primary-100/50",
  IDLE: "from-success-50 to-success-100/50",
  MAINTENANCE: "from-warning-50 to-warning-100/50",
  SHUTDOWN: "from-danger-50 to-danger-100/50",
};

// ============================================================
// Machine Operator Dashboard
// ============================================================

export default function OperatorDashboardPage() {
  const { data: session } = useSession();
  const [machines, setMachines] = useState<MachineData[]>(mockMachines);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; machine: MachineData | null; action: string }>({
    open: false,
    machine: null,
    action: "",
  });

  if (session?.user?.role !== "OPERATOR") {
    redirect("/dashboard");
  }

  const handleMachineAction = (machine: MachineData, action: string) => {
    setConfirmDialog({ open: true, machine, action });
  };

  const confirmAction = () => {
    if (!confirmDialog.machine) return;

    setMachines((prev) =>
      prev.map((m) => {
        if (m.id === confirmDialog.machine?.id) {
          let newStatus = m.status;
          switch (confirmDialog.action) {
            case "start": newStatus = "ACTIVE"; break;
            case "pause": newStatus = "IDLE"; break;
            case "resume": newStatus = "ACTIVE"; break;
            case "maintenance": newStatus = "MAINTENANCE"; break;
            case "stop": newStatus = "SHUTDOWN"; break;
          }
          return { ...m, status: newStatus };
        }
        return m;
      })
    );
    setConfirmDialog({ open: false, machine: null, action: "" });
  };

  const availableCount = machines.filter((m) => m.status === "IDLE").length;
  const inUseCount = machines.filter((m) => m.status === "ACTIVE").length;
  const offlineCount = machines.filter((m) => ["SHUTDOWN", "MAINTENANCE"].includes(m.status)).length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Machines" value={String(machines.length)} icon={<Cpu size={28} />} />
        <KPICard title="Available" value={String(availableCount)} icon={<CheckCircle2 size={28} />} variant="highlight" />
        <KPICard title="In Use" value={String(inUseCount)} icon={<Activity size={28} />} />
        <KPICard title="Offline / Maintenance" value={String(offlineCount)} icon={<XCircle size={28} />} />
      </div>

      {/* Machine Grid */}
      <div>
        <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-4">
          Machine Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map((machine) => (
            <Card
              key={machine.id}
              className={cn(
                "relative overflow-hidden bg-gradient-to-br border-2",
                statusBg[machine.status],
                statusColors[machine.status]
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <Badge variant="info" className="text-xs mb-2">{machine.type}</Badge>
                  <h3 className="text-lg font-black text-gray-900">{machine.name}</h3>
                </div>
                <StatusIndicator status={machine.status} />
              </div>

              {machine.currentPart && (
                <p className="text-sm text-gray-600 mb-2">
                  Current Part: <strong>{machine.currentPart}</strong>
                </p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                <span className="flex items-center gap-1">
                  <Activity size={12} /> Uptime: {machine.uptime}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} /> Today: {machine.inspectionsToday}
                </span>
              </div>

              <div className="flex gap-2 flex-wrap">
                {machine.status === "IDLE" && (
                  <Button size="sm" variant="success" icon={<Power size={14} />} onClick={() => handleMachineAction(machine, "start")}>
                    Start
                  </Button>
                )}
                {machine.status === "ACTIVE" && (
                  <Button size="sm" variant="secondary" icon={<Pause size={14} />} onClick={() => handleMachineAction(machine, "pause")}>
                    Pause
                  </Button>
                )}
                {machine.status !== "MAINTENANCE" && machine.status !== "SHUTDOWN" && (
                  <Button size="sm" variant="secondary" icon={<Wrench size={14} />} onClick={() => handleMachineAction(machine, "maintenance")}>
                    Maintenance
                  </Button>
                )}
                {machine.status !== "SHUTDOWN" && (
                  <Button size="sm" variant="danger" icon={<AlertTriangle size={14} />} onClick={() => handleMachineAction(machine, "stop")}>
                    Stop
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Alerts Panel */}
      <div>
        <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-4">
          Alerts
        </h2>
        <div className="space-y-3">
          {mockAlerts.map((alert) => (
            <Card
              key={alert.id}
              className={cn(
                "flex items-start gap-3 border-l-4",
                alert.severity === "critical" && "border-l-danger-500 bg-danger-50",
                alert.severity === "warning" && "border-l-warning-500 bg-warning-50",
                alert.severity === "info" && "border-l-primary-500 bg-primary-50"
              )}
            >
              <AlertTriangle
                size={18}
                className={cn(
                  alert.severity === "critical" && "text-danger-500",
                  alert.severity === "warning" && "text-warning-500",
                  alert.severity === "info" && "text-primary-500"
                )}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                <p className="text-xs text-gray-500 mt-1">{alert.time}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, machine: null, action: "" })}
        onConfirm={confirmAction}
        title={confirmDialog.machine?.name || "Machine"}
        message={`Do you want to proceed with ${confirmDialog.action}ing this machine?`}
        confirmText="Confirm"
      />
    </div>
  );
}
