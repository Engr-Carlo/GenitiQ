"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, Button, Badge, DataTable, Modal, KPICard, ConfirmDialog } from "@/components/ui";
import {
  ArrowLeft, Plus, RotateCcw, Settings2,
  Layers3, Timer, BarChart3,
  Cpu, Scan, Zap, Move, GripVertical, ChevronUp, ChevronDown,
} from "lucide-react";

// ============================================================
// Mock Data
// ============================================================

const machinesMock: Record<string, Array<{
  id: string;
  name: string;
  status: "ACTIVE" | "IDLE" | "MAINTENANCE" | "SHUTDOWN";
  currentPart: string | null;
  queueLength: number;
  avgCycleTime: string;
  utilization: string;
}>> = {
  vmm: [
    { id: "vmm-1", name: "VMM-1", status: "ACTIVE", currentPart: "PN1001", queueLength: 5, avgCycleTime: "12 min", utilization: "87%" },
    { id: "vmm-2", name: "VMM-2", status: "ACTIVE", currentPart: "PN1003", queueLength: 3, avgCycleTime: "15 min", utilization: "72%" },
    { id: "vmm-3", name: "VMM-3", status: "IDLE", currentPart: null, queueLength: 0, avgCycleTime: "—", utilization: "0%" },
    { id: "vmm-4", name: "VMM-4", status: "MAINTENANCE", currentPart: null, queueLength: 0, avgCycleTime: "—", utilization: "0%" },
    { id: "vmm-5", name: "VMM-5", status: "ACTIVE", currentPart: "PN1010", queueLength: 4, avgCycleTime: "14 min", utilization: "65%" },
    { id: "vmm-6", name: "VMM-6", status: "ACTIVE", currentPart: "PN1012", queueLength: 6, avgCycleTime: "11 min", utilization: "91%" },
  ],
  cmm: [
    { id: "cmm-1", name: "CMM-1", status: "ACTIVE", currentPart: "PN2001", queueLength: 4, avgCycleTime: "22 min", utilization: "78%" },
    { id: "cmm-2", name: "CMM-2", status: "ACTIVE", currentPart: "PN2005", queueLength: 3, avgCycleTime: "25 min", utilization: "82%" },
    { id: "cmm-3", name: "CMM-3", status: "IDLE", currentPart: null, queueLength: 0, avgCycleTime: "—", utilization: "0%" },
    { id: "cmm-4", name: "CMM-4", status: "SHUTDOWN", currentPart: null, queueLength: 0, avgCycleTime: "—", utilization: "0%" },
  ],
};

const queueItemsMock = [
  { id: "q1", position: 1, partNumber: "PN1020", priority: "HIGH" as const, estimatedTime: "12 min", waitTime: "3 min", assignedBy: "GA Algorithm" },
  { id: "q2", position: 2, partNumber: "PN1021", priority: "MEDIUM" as const, estimatedTime: "15 min", waitTime: "15 min", assignedBy: "GA Algorithm" },
  { id: "q3", position: 3, partNumber: "PN1022", priority: "LOW" as const, estimatedTime: "10 min", waitTime: "27 min", assignedBy: "Manual" },
  { id: "q4", position: 4, partNumber: "PN1023", priority: "HIGH" as const, estimatedTime: "18 min", waitTime: "37 min", assignedBy: "GA Algorithm" },
  { id: "q5", position: 5, partNumber: "PN1024", priority: "MEDIUM" as const, estimatedTime: "14 min", waitTime: "55 min", assignedBy: "GA Algorithm" },
];

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

  const machines = machinesMock[machineTypeKey] || [];
  const isVMM = machineTypeKey === "vmm";

  // Queue view for a selected machine
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [addPartModal, setAddPartModal] = useState(false);
  const [confirmOptimize, setConfirmOptimize] = useState(false);

  const selectedMachineData = machines.find((m) => m.id === selectedMachine);

  const activeMachines = machines.filter((m) => m.status === "ACTIVE").length;
  const totalQueue = machines.reduce((sum, m) => sum + m.queueLength, 0);

  const queueColumns = [
    {
      key: "position",
      header: "#",
      render: (item: (typeof queueItemsMock)[0]) => (
        <div className="flex items-center gap-1">
          <GripVertical size={14} className="text-gray-300" />
          <span className="font-black text-gray-700">{item.position}</span>
        </div>
      ),
    },
    { key: "partNumber", header: "Part No.", className: "font-bold" },
    {
      key: "priority",
      header: "Priority",
      render: (item: (typeof queueItemsMock)[0]) => (
        <Badge variant={priorityVariant[item.priority]}>{item.priority}</Badge>
      ),
    },
    { key: "estimatedTime", header: "Est. Time" },
    { key: "waitTime", header: "Wait Time" },
    {
      key: "assignedBy",
      header: "Assigned By",
      render: (item: (typeof queueItemsMock)[0]) => (
        <span className={item.assignedBy === "GA Algorithm" ? "text-primary-600 font-bold" : "text-gray-500"}>
          {item.assignedBy === "GA Algorithm" && <Zap size={12} className="inline mr-1" />}
          {item.assignedBy}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_item: (typeof queueItemsMock)[0]) => (
        <div className="flex gap-1">
          <button className="p-1 hover:bg-gray-100 rounded" title="Move Up">
            <ChevronUp size={16} className="text-gray-400 hover:text-gray-700" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded" title="Move Down">
            <ChevronDown size={16} className="text-gray-400 hover:text-gray-700" />
          </button>
        </div>
      ),
    },
  ];

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
              {isVMM ? "Video Measuring Machine" : "Coordinate Measuring Machine"} — GA-Optimized Queue
            </p>
          </div>
        </div>
        <Button variant="primary" icon={<RotateCcw size={16} />} onClick={() => setConfirmOptimize(true)}>
          Re-Optimize Queue
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Active Machines" value={`${activeMachines}/${machines.length}`} icon={<Cpu size={24} />} />
        <KPICard title="Total in Queue" value={String(totalQueue)} icon={<Layers3 size={24} />} />
        <KPICard title="Avg. Cycle Time" value="14 min" icon={<Timer size={24} />} />
        <KPICard title="Throughput" value="32/hr" icon={<BarChart3 size={24} />} variant="highlight" />
      </div>

      {/* Two-column layout: Machines | Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Machine Cards */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-500 mb-2">Machines</h2>
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
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColors[machine.status]}`} />
                    <span className="font-black text-lg">{machine.name}</span>
                  </div>
                  <Badge
                    variant={
                      machine.status === "ACTIVE"
                        ? "success"
                        : machine.status === "IDLE"
                        ? "gray"
                        : machine.status === "MAINTENANCE"
                        ? "warning"
                        : "danger"
                    }
                  >
                    {machine.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 block">Current</span>
                    <span className="font-bold">{machine.currentPart || "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Queue</span>
                    <span className="font-bold">{machine.queueLength} parts</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Util.</span>
                    <span className="font-bold">{machine.utilization}</span>
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
                  Queue for {selectedMachineData.name}
                </h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => setAddPartModal(true)}>
                    Add Part
                  </Button>
                  <Button variant="outline" size="sm" icon={<Settings2 size={14} />}>
                    GA Settings
                  </Button>
                </div>
              </div>

              <Card>
                <div className="p-3 bg-gradient-to-r from-primary-50 to-white border-b border-primary-100">
                  <div className="flex items-center gap-2 text-sm">
                    <Zap size={16} className="text-primary-600" />
                    <span className="font-bold text-primary-700">GA-Optimized Order</span>
                    <span className="text-gray-400 ml-auto text-xs">Last optimized: 2 min ago</span>
                  </div>
                </div>
                <DataTable columns={queueColumns} data={queueItemsMock} />
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-80">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Move size={28} className="text-gray-300" />
                </div>
                <p className="text-gray-400 font-bold">Select a machine to view its queue</p>
                <p className="text-gray-300 text-sm mt-1">Click on an active machine card on the left</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Part Modal */}
      <Modal isOpen={addPartModal} onClose={() => setAddPartModal(false)} title="Add Part to Queue">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Part Number</label>
            <input className="input-field" placeholder="Enter part number..." />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Priority</label>
            <select className="input-field">
              <option>LOW</option>
              <option>MEDIUM</option>
              <option selected>HIGH</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea className="input-field min-h-[80px] resize-none" placeholder="Any special instructions..." />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setAddPartModal(false)}>Cancel</Button>
            <Button variant="primary" icon={<Plus size={16} />}>Add to Queue</Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Re-optimize */}
      <ConfirmDialog
        isOpen={confirmOptimize}
        onClose={() => setConfirmOptimize(false)}
        onConfirm={() => setConfirmOptimize(false)}
        title="Re-Optimize Queue?"
        message="This will run the Genetic Algorithm to recalculate optimal queue ordering across all active machines. Current manual overrides will be preserved."
        confirmText="Run GA Optimizer"
        variant="primary"
      />
    </div>
  );
}
