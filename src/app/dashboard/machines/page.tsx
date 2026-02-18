"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Badge, Button, DataTable, KPICard, ConfirmDialog, LoadingSpinner } from "@/components/ui";
import {
  Cpu, Scan, AlertTriangle, Settings, Power,
  PowerOff, Wrench, CheckCircle2,
} from "lucide-react";

interface Machine {
  id: string;
  name: string;
  type: "VMM" | "CMM";
  status: "ACTIVE" | "IDLE" | "MAINTENANCE" | "SHUTDOWN";
  location?: string | null;
  queueLength: number;
  hasActiveSession?: boolean;
}

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
  const { data: session } = useSession();
  const [filter, setFilter] = useState<"ALL" | "VMM" | "CMM">("ALL");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{ 
    open: boolean; 
    machineId: string | null; 
    action: "shutdown" | "activate" | null;
    machineName: string | null;
  }>({ open: false, machineId: null, action: null, machineName: null });
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check if user is operator - operators should not see action buttons
  const isOperator = session?.user?.role === "OPERATOR";
  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/machines");
      const data = await res.json();
      setMachines(data.data || []);
    } catch (error) {
      console.error("Failed to fetch machines:", error);
      setMessage({ type: "error", text: "Failed to load machines" });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (machineId: string, newStatus: "ACTIVE" | "SHUTDOWN") => {
    setUpdating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/machines/${machineId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: `Machine ${newStatus === "ACTIVE" ? "activated" : "shut down"} successfully` });
        await fetchMachines();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update machine status" });
      }
    } catch (error) {
      console.error("Failed to update machine status:", error);
      setMessage({ type: "error", text: "Failed to update machine status" });
    } finally {
      setUpdating(false);
      setActionDialog({ open: false, machineId: null, action: null, machineName: null });
    }
  };

  const filtered = filter === "ALL" ? machines : machines.filter((m) => m.type === filter);
  const activeMachines = machines.filter((m) => m.status === "ACTIVE").length;
  const maintenanceMachines = machines.filter((m) => m.status === "MAINTENANCE").length;
  const shutdownMachines = machines.filter((m) => m.status === "SHUTDOWN").length;

  const columns = [
    {
      key: "name",
      header: "Machine",
      render: (item: Machine) => (
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
            <p className="text-xs text-gray-400">{item.location || "No location"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (item: Machine) => <Badge variant="info">{item.type}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      render: (item: Machine) => (
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusColors[item.status]}`} />
          <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
        </div>
      ),
    },
    { 
      key: "queueLength", 
      header: "Queue", 
      render: (item: Machine) => <span className="font-bold">{item.queueLength}</span> 
    },
    { 
      key: "sessionStatus", 
      header: "Session", 
      render: (item: Machine) => (
        <Badge variant={item.hasActiveSession ? "warning" : "gray"}>
          {item.hasActiveSession ? "In Use" : "Available"}
        </Badge>
      )
    },
    // Only show actions for admins
    ...(isAdmin ? [{
      key: "actions",
      header: "Actions",
      render: (item: Machine) => (
        <div className="flex gap-1">
          {item.status === "ACTIVE" && (
            <Button
              size="sm"
              variant="danger"
              icon={<PowerOff size={14} />}
              onClick={() => setActionDialog({ 
                open: true, 
                machineId: item.id, 
                action: "shutdown",
                machineName: item.name 
              })}
              disabled={updating}
            >
              Shutdown
            </Button>
          )}
          {item.status === "SHUTDOWN" && (
            <Button 
              size="sm" 
              variant="success" 
              icon={<Power size={14} />}
              onClick={() => setActionDialog({ 
                open: true, 
                machineId: item.id, 
                action: "activate",
                machineName: item.name 
              })}
              disabled={updating}
            >
              Activate
            </Button>
          )}
        </div>
      ),
    }] : []),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success" ? "bg-success-50 text-success-900" : "bg-danger-50 text-danger-900"
          }`}
        >
          {message.text}
        </div>
      )}

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
        <KPICard title="Total Machines" value={String(machines.length)} icon={<Cpu size={24} />} />
        <KPICard title="Active" value={String(activeMachines)} icon={<CheckCircle2 size={24} />} variant="highlight" />
        <KPICard title="Maintenance" value={String(maintenanceMachines)} icon={<Wrench size={24} />} />
        <KPICard title="Shutdown" value={String(shutdownMachines)} icon={<AlertTriangle size={24} />} />
      </div>

      {/* Machine Table */}
      <DataTable columns={columns} data={filtered} />

      {/* Action Confirm Dialog */}
      <ConfirmDialog
        isOpen={actionDialog.open}
        onClose={() => setActionDialog({ open: false, machineId: null, action: null, machineName: null })}
        onConfirm={() => {
          if (actionDialog.machineId && actionDialog.action) {
            handleStatusChange(
              actionDialog.machineId, 
              actionDialog.action === "activate" ? "ACTIVE" : "SHUTDOWN"
            );
          }
        }}
        title={actionDialog.action === "shutdown" ? "Shutdown Machine?" : "Activate Machine?"}
        message={
          actionDialog.action === "shutdown"
            ? `Are you sure you want to shutdown ${actionDialog.machineName}? This will prevent operators from using it.`
            : `Are you sure you want to activate ${actionDialog.machineName}? It will become available for use.`
        }
        confirmText={actionDialog.action === "shutdown" ? "Shutdown" : "Activate"}
        variant={actionDialog.action === "shutdown" ? "danger" : "primary"}
      />
    </div>
  );
}
