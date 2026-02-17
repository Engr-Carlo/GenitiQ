"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, Button, Badge, KPICard, ConfirmDialog, StatusIndicator, LoadingSpinner } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  Cpu, Power, Pause, AlertTriangle,
  Wrench, Activity, Clock, CheckCircle2, XCircle, ListChecks,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface MachineData {
  id: string;
  name: string;
  type: "VMM" | "CMM";
  status: "ACTIVE" | "IDLE" | "MAINTENANCE" | "SHUTDOWN";
  location?: string | null;
  queueLength?: number;
}

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
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<MachineData[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; machine: MachineData | null; action: string }>({
    open: false,
    machine: null,
    action: "",
  });

  if (session?.user?.role !== "OPERATOR") {
    redirect("/dashboard");
  }

  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/machines");
      const data = await response.json();
      setMachines(data.data || []);
    } catch (error) {
      console.error("Error fetching machines:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMachineAction = (machine: MachineData, action: string) => {
    setConfirmDialog({ open: true, machine, action });
  };

  const confirmAction = async () => {
    if (!confirmDialog.machine) return;

    try {
      let newStatus = confirmDialog.machine.status;
      switch (confirmDialog.action) {
        case "start": newStatus = "ACTIVE"; break;
        case "pause": newStatus = "IDLE"; break;
        case "resume": newStatus = "ACTIVE"; break;
        case "maintenance": newStatus = "MAINTENANCE"; break;
        case "stop": newStatus = "SHUTDOWN"; break;
      }

      // Update machine status via API
      const response = await fetch(`/api/machines/${confirmDialog.machine.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // Update local state
        setMachines((prev) =>
          prev.map((m) => {
            if (m.id === confirmDialog.machine?.id) {
              return { ...m, status: newStatus };
            }
            return m;
          })
        );
      }
    } catch (error) {
      console.error("Error updating machine status:", error);
    }

    setConfirmDialog({ open: false, machine: null, action: "" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

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
                  {machine.location && (
                    <p className="text-xs text-gray-500">{machine.location}</p>
                  )}
                </div>
                <StatusIndicator status={machine.status} />
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                <span className="flex items-center gap-1">
                  <ListChecks size={12} /> Queue: {machine.queueLength || 0}
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
