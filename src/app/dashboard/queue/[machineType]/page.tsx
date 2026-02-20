"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Button, Badge, DataTable, KPICard, LoadingSpinner } from "@/components/ui";
import {
  ArrowLeft, RotateCcw,
  Layers3, Timer, BarChart3,
  Cpu, Scan, Move, GripVertical,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface MachineInfo {
  id: string;
  name: string;
  type: string;
  status: string;
  queueLength: number;
  currentOperator: { id: string; name: string } | null;
  hasActiveSession: boolean;
}

interface QueueItem {
  id: string;
  partNumber: string;
  barcode: string;
  estimatedTime: number;
  deadline: string;
  quantity: number;
  position: number;
  priority: string;
  machine: { id: string; name: string; type: string } | null;
  inspector: { id: string; name: string } | null;
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-success-500",
  IDLE: "bg-gray-400",
  MAINTENANCE: "bg-warning-500",
  SHUTDOWN: "bg-danger-500",
};

const priorityVariant: Record<string, "success" | "warning" | "danger"> = {
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "success",
};

// ============================================================
// Queue Machine List Page
// ============================================================

export default function QueueMachineListPage() {
  const params = useParams();
  const router = useRouter();
  const machineType = (params.machineType as string)?.toUpperCase();
  const machineTypeKey = (params.machineType as string)?.toLowerCase();
  const isVMM = machineTypeKey === "vmm";

  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<MachineInfo[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);

  useEffect(() => {
    fetchMachines();
  }, [machineType]);

  useEffect(() => {
    if (selectedMachine) {
      fetchQueue(selectedMachine);
    }
  }, [selectedMachine]);

  const fetchMachines = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/machines?type=${machineType}`);
      const data = await res.json();
      setMachines(data.data || []);
    } catch (error) {
      console.error("Error fetching machines:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueue = async (machineId: string) => {
    try {
      const res = await fetch(`/api/queue?machineId=${machineId}`);
      const data = await res.json();
      const items: QueueItem[] = (data.data || []).map((item: any, index: number) => ({
        ...item,
        position: item.position || index + 1,
        priority: computePriority(item),
      }));
      setQueueItems(items);
    } catch (error) {
      console.error("Error fetching queue:", error);
    }
  };

  const computePriority = (item: any): string => {
    const hoursToDeadline = (new Date(item.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
    const urgencyScore = Math.max(0, 100 - hoursToDeadline / 2);
    const complexityScore = (item.estimatedTime / 60) * 50 + (item.quantity / 10) * 50;
    const fitness = urgencyScore * 0.6 + complexityScore * 0.4;
    if (fitness > 70 || hoursToDeadline < 24) return "HIGH";
    if (fitness > 40 || hoursToDeadline < 72) return "MEDIUM";
    return "LOW";
  };

  const selectedMachineData = machines.find((m) => m.id === selectedMachine);
  const activeMachines = machines.filter((m) => m.status === "ACTIVE" || m.hasActiveSession).length;
  const totalQueue = machines.reduce((sum, m) => sum + (m.queueLength || 0), 0);

  const queueColumns = [
    {
      key: "position",
      header: "#",
      render: (item: QueueItem) => (
        <div className="flex items-center gap-1">
          <GripVertical size={14} className="text-gray-300" />
          <span className="font-black text-gray-700">{item.position}</span>
        </div>
      ),
    },
    { key: "partNumber", header: "Part No.", className: "font-bold" },
    {
      key: "barcode",
      header: "Barcode",
      render: (item: QueueItem) => <span className="font-mono text-sm">{item.barcode}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      render: (item: QueueItem) => (
        <Badge variant={priorityVariant[item.priority] || "success"}>
          {item.priority}
        </Badge>
      ),
    },
    {
      key: "estimatedTime",
      header: "Est. Time",
      render: (item: QueueItem) => `${item.estimatedTime} min`,
    },
    {
      key: "deadline",
      header: "Deadline",
      render: (item: QueueItem) => {
        const d = new Date(item.deadline);
        const hoursLeft = (d.getTime() - Date.now()) / (1000 * 60 * 60);
        return (
          <span className={hoursLeft < 24 ? "text-danger-600 font-bold" : ""}>
            {d.toLocaleDateString()}
          </span>
        );
      },
    },
    {
      key: "quantity",
      header: "Qty",
      render: (item: QueueItem) => <span className="font-bold">{item.quantity}</span>,
    },
    {
      key: "inspector",
      header: "Assigned Inspector",
      render: (item: QueueItem) => item.inspector?.name || <span className="text-gray-400">—</span>,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/queue")}>
            <ArrowLeft size={18} />
          </Button>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
              isVMM ? "bg-gradient-to-br from-primary-500 to-primary-700" : "bg-gradient-to-br from-navy-600 to-navy-800"
            }`}
          >
            {isVMM ? <Scan size={22} /> : <Cpu size={22} />}
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900">
              {machineType} Queue Management
            </h1>
            <p className="text-gray-500 text-sm">
              {isVMM ? "Video Measuring Machine" : "Coordinate Measuring Machine"} — Queue Overview
            </p>
          </div>
        </div>
        <Button variant="primary" icon={<RotateCcw size={16} />} onClick={() => { fetchMachines(); if (selectedMachine) fetchQueue(selectedMachine); }}>
          Refresh
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Active Machines" value={`${activeMachines}/${machines.length}`} icon={<Cpu size={24} />} />
        <KPICard title="Total in Queue" value={String(totalQueue)} icon={<Layers3 size={24} />} />
        <KPICard title="Machines" value={String(machines.length)} icon={<Timer size={24} />} />
        <KPICard title="Selected Queue" value={selectedMachine ? String(queueItems.length) : "—"} icon={<BarChart3 size={24} />} variant="highlight" />
      </div>

      {/* Two-column layout: Machines | Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Machine Cards */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-500 mb-2">Machines</h2>
          {machines.length === 0 && (
            <Card className="text-center py-8">
              <p className="text-gray-400 font-bold">No {machineType} machines found</p>
            </Card>
          )}
          {machines.map((machine) => (
            <div
              key={machine.id}
              onClick={() => machine.status !== "SHUTDOWN" && machine.status !== "MAINTENANCE" && setSelectedMachine(machine.id)}
              className={`card cursor-pointer border-2 transition-all duration-200 ${
                selectedMachine === machine.id
                  ? "border-primary-400 shadow-md ring-2 ring-primary-100"
                  : "border-transparent hover:border-gray-200"
              } ${machine.status === "SHUTDOWN" || machine.status === "MAINTENANCE" ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors[machine.status] || "bg-gray-400"}`} />
                    <span className="font-black text-lg">{machine.name}</span>
                  </div>
                  <Badge
                    variant={
                      machine.hasActiveSession
                        ? "success"
                        : machine.status === "MAINTENANCE"
                        ? "warning"
                        : machine.status === "SHUTDOWN"
                        ? "danger"
                        : "gray"
                    }
                  >
                    {machine.hasActiveSession ? "IN USE" : machine.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 block">Operator</span>
                    <span className="font-bold">{machine.currentOperator?.name || "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Queue</span>
                    <span className="font-bold">{machine.queueLength} parts</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Status</span>
                    <span className="font-bold">{machine.hasActiveSession ? "Active" : "Idle"}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Queue Detail */}
        <div className="lg:col-span-8">
          {selectedMachine && selectedMachineData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-wider text-gray-500">
                  Queue for {selectedMachineData.name} ({queueItems.length} parts)
                </h2>
              </div>

              {queueItems.length > 0 ? (
                <Card>
                  <DataTable columns={queueColumns} data={queueItems} />
                </Card>
              ) : (
                <Card className="text-center py-12">
                  <Layers3 size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-400 font-bold">No parts in queue for {selectedMachineData.name}</p>
                  <p className="text-gray-300 text-sm mt-1">All parts have been processed or none are assigned</p>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-80">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Move size={28} className="text-gray-300" />
                </div>
                <p className="text-gray-400 font-bold">Select a machine to view its queue</p>
                <p className="text-gray-300 text-sm mt-1">Click on a machine card on the left</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
