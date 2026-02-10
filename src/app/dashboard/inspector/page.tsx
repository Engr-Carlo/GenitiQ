"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, Button, Badge, DataTable, KPICard } from "@/components/ui";
import {
  ClipboardCheck, Clock, CheckCircle2, XCircle,
  AlertTriangle, Timer, TrendingUp, ListChecks,
} from "lucide-react";

// ============================================================
// Mock Data
// ============================================================

const mockQueue = [
  { position: 1, partNumber: "PN1005", priority: "HIGH", estTime: "12 min", machine: "VMM-1", status: "Next" },
  { position: 2, partNumber: "PN1008", priority: "HIGH", estTime: "18 min", machine: "VMM-1", status: "Queued" },
  { position: 3, partNumber: "PN1012", priority: "HIGH", estTime: "15 min", machine: "VMM-2", status: "Queued" },
  { position: 4, partNumber: "PN1003", priority: "MEDIUM", estTime: "20 min", machine: "VMM-1", status: "Queued" },
  { position: 5, partNumber: "PN1015", priority: "MEDIUM", estTime: "25 min", machine: "CMM-1", status: "Queued" },
  { position: 6, partNumber: "PN1020", priority: "LOW", estTime: "10 min", machine: "CMM-2", status: "Queued" },
];

const mockActiveInspection = {
  partNumber: "PN1001",
  machine: "VMM Machine 1",
  startTime: "13:30:00",
  elapsed: "00:15:23",
  priority: "HIGH",
};

const mockPerformance = {
  totalInspections: 47,
  passRate: "93.6%",
  avgTime: "18.2 min",
  todayCompleted: 8,
};

// ============================================================
// Inspector Dashboard
// ============================================================

export default function InspectorDashboardPage() {
  const { data: session } = useSession();
  const [activeInspection, _setActiveInspection] = useState(mockActiveInspection);
  const [_showResult, _setShowResult] = useState(false);

  if (session?.user?.role !== "INSPECTOR") {
    redirect("/dashboard");
  }

  const priorityColors: Record<string, "danger" | "warning" | "info" | "gray"> = {
    HIGH: "danger",
    MEDIUM: "warning",
    LOW: "info",
  };

  const queueColumns = [
    { key: "position", header: "#", className: "w-12 font-bold" },
    { key: "partNumber", header: "Part Number", className: "font-bold" },
    {
      key: "priority",
      header: "Priority",
      render: (item: (typeof mockQueue)[0]) => (
        <Badge variant={priorityColors[item.priority]}>{item.priority}</Badge>
      ),
    },
    { key: "estTime", header: "Est. Time" },
    { key: "machine", header: "Machine" },
    {
      key: "status",
      header: "Status",
      render: (item: (typeof mockQueue)[0]) =>
        item.status === "Next" ? (
          <Badge variant="success">Next</Badge>
        ) : (
          <Badge variant="gray">Queued</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Performance KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Inspections"
          value={String(mockPerformance.totalInspections)}
          icon={<ClipboardCheck size={28} />}
        />
        <KPICard
          title="Pass Rate"
          value={mockPerformance.passRate}
          icon={<TrendingUp size={28} />}
          variant="highlight"
        />
        <KPICard
          title="Avg. Inspection Time"
          value={mockPerformance.avgTime}
          icon={<Timer size={28} />}
        />
        <KPICard
          title="Completed Today"
          value={String(mockPerformance.todayCompleted)}
          icon={<CheckCircle2 size={28} />}
        />
      </div>

      {/* Active Inspection */}
      {activeInspection && (
        <Card className="border-l-4 border-l-primary-600 bg-gradient-to-r from-primary-50 to-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-primary-600">
                Active Inspection
              </h2>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {activeInspection.partNumber}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {activeInspection.machine}
                </span>
                <span className="flex items-center gap-1">
                  <Timer size={14} />
                  Elapsed: {activeInspection.elapsed}
                </span>
                <Badge variant={priorityColors[activeInspection.priority]}>
                  {activeInspection.priority}
                </Badge>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="success" icon={<CheckCircle2 size={18} />}>
                Accept
              </Button>
              <Button variant="danger" icon={<XCircle size={18} />}>
                Reject
              </Button>
              <Button
                variant="secondary"
                icon={<AlertTriangle size={18} />}
                className="text-warning-600 border-warning-300 hover:bg-warning-50"
              >
                Request Shutdown
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* GA-Optimized Queue */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 flex items-center gap-2">
            <ListChecks size={22} className="text-primary-600" />
            GA-Optimized Inspection Queue
          </h2>
          <Badge variant="info">Fitness Score: 0.847</Badge>
        </div>
        <DataTable columns={queueColumns} data={mockQueue} />
      </div>
    </div>
  );
}
