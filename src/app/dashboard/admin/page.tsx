 "use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, DataTable, Badge, KPICard, LoadingSpinner, Button } from "@/components/ui";
import {
  DefectRateTrendChart,
  YieldTrendChart,
  DefectsBarChart,
  DistributionPieChart,
  MiniStat,
  BigYieldDisplay,
} from "@/components/charts";
import {
  Cpu, Activity, Users, Clock, Timer,
  CheckCircle2, AlertTriangle, TrendingUp,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface ActiveSession {
  id: string;
  operatorName: string;
  machineName: string;
  machineType: string;
  startTime: string;
  itemsCompleted: number;
  status: string;
}

interface TimingData {
  avgQueueTime: number | null;
  avgInspectionTime: number | null;
  totalCycleTime: number | null;
}

// ============================================================
// Admin Dashboard Page
// ============================================================

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    defectRate: "0%",
    yieldRate: "0%",
    totalInspections: 0,
    queuedParts: 0,
  });
  const [recentInspections, setRecentInspections] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [timing, setTiming] = useState<TimingData>({ avgQueueTime: null, avgInspectionTime: null, totalCycleTime: null });

  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch analytics + timing in parallel
      const [analyticsRes, timingRes] = await Promise.all([
        fetch("/api/analytics?period=7d"),
        fetch("/api/analytics/timing"),
      ]);

      const analyticsData = await analyticsRes.json();
      const timingData = await timingRes.json();

      if (analyticsData.data) {
        setKpis({
          defectRate: analyticsData.data.kpis.defectRate,
          yieldRate: analyticsData.data.kpis.yieldRate,
          totalInspections: analyticsData.data.kpis.totalInspections,
          queuedParts: analyticsData.data.kpis.queuedParts,
        });
        setRecentInspections(analyticsData.data.recentInspections || []);
      }

      if (timingData.data) {
        setTiming({
          avgQueueTime: timingData.data.summary?.avgQueueTime ?? null,
          avgInspectionTime: timingData.data.summary?.avgInspectionTime ?? null,
          totalCycleTime: timingData.data.summary?.totalCycleTime ?? null,
        });
        // Map active sessions
        const sessions: ActiveSession[] = (timingData.data.activeSessions || []).map((s: any) => ({
          id: s.id,
          operatorName: s.operator?.name || "-",
          machineName: s.machine?.name || "-",
          machineType: s.machine?.type || "-",
          startTime: s.startTime,
          itemsCompleted: s.itemsCompleted,
          status: s.status,
        }));
        setActiveSessions(sessions);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
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

  // Chart data
  const defectRateTrend = [
    { label: "Incoming", value: 2.0 },
    { label: "In-Process", value: 1.1 },
    { label: "Final", value: 0.2 },
  ];

  const yieldTrend = [
    { label: "Sun", value: 0.75 },
    { label: "Mon", value: 0.78 },
    { label: "Tue", value: 0.76 },
    { label: "Wed", value: 0.78 },
    { label: "Thu", value: 0.80 },
    { label: "Fri", value: 0.82 },
    { label: "Sat", value: 0.80 },
    { label: "Sun", value: 0.83 },
    { label: "Mon", value: 0.85 },
    { label: "Tue", value: 0.87 },
  ];

  const defectsByInspection = [
    { label: "Incoming", value: 18 },
    { label: "In-Process", value: 12 },
    { label: "Final", value: 5 },
  ];

  const distributionData = [
    { name: "Passed", value: 75, color: "#1e40af" },
    { name: "Failed", value: 25, color: "#60a5fa" },
  ];

  const inspectionColumns = [
    {
      key: "partNumber",
      header: "Part No.",
      className: "font-bold",
      render: (item: any) => item.part?.partNumber || "-",
    },
    {
      key: "result",
      header: "Status",
      render: (item: any) => (
        <Badge variant={item.result === "ACCEPTED" ? "success" : "danger"}>
          {item.result}
        </Badge>
      ),
    },
    {
      key: "machineType",
      header: "Machine",
      render: (item: any) => item.machine?.name || item.machine?.type || "-",
    },
    {
      key: "inspector",
      header: "Operator",
      render: (item: any) => item.inspector?.name || "-",
    },
    {
      key: "qaDecision",
      header: "QA Decision",
      render: (item: any) => {
        if (!item.qaDecision) return <Badge variant="warning">Pending</Badge>;
        const variant = item.qaDecision === "APPROVED" ? "success" : item.qaDecision === "CONFIRMED_REJECT" ? "danger" : "info";
        return <Badge variant={variant}>{item.qaDecision.replace("_", " ")}</Badge>;
      },
    },
    {
      key: "createdAt",
      header: "Date",
      render: (item: any) => new Date(item.createdAt).toLocaleDateString(),
    },
  ];

  const sessionColumns = [
    { key: "operatorName", header: "Operator", className: "font-bold" },
    { key: "machineName", header: "Machine" },
    {
      key: "machineType",
      header: "Type",
      render: (item: ActiveSession) => (
        <Badge variant={item.machineType === "VMM" ? "info" : "warning"}>{item.machineType}</Badge>
      ),
    },
    {
      key: "startTime",
      header: "Started",
      render: (item: ActiveSession) => new Date(item.startTime).toLocaleTimeString(),
    },
    {
      key: "itemsCompleted",
      header: "Items Done",
      render: (item: ActiveSession) => <span className="font-bold">{item.itemsCompleted}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (item: ActiveSession) => (
        <Badge variant={item.status === "ACTIVE" ? "success" : "warning"}>{item.status}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MiniStat title="Defect Rate" value={kpis.defectRate} />
        <MiniStat title="Queued Parts" value={String(kpis.queuedParts)} />
        <BigYieldDisplay value={kpis.yieldRate} />
        <MiniStat title="Total Inspections" value={String(kpis.totalInspections)} />
        <MiniStat title="Yield Rate" value={kpis.yieldRate} />
      </div>

      {/* Timing KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Active Sessions"
          value={String(activeSessions.length)}
          icon={<Users size={28} />}
          variant="highlight"
        />
        <KPICard
          title="Avg Operator Time"
          value={timing.avgQueueTime ? `${timing.avgQueueTime.toFixed(1)} min` : "- min"}
          icon={<Timer size={28} />}
        />
        <KPICard
          title="Avg Review Time"
          value={timing.avgInspectionTime ? `${timing.avgInspectionTime.toFixed(1)} min` : "- min"}
          icon={<Clock size={28} />}
        />
        <KPICard
          title="Total Cycle Time"
          value={timing.totalCycleTime ? `${timing.totalCycleTime.toFixed(1)} min` : "- min"}
          icon={<Activity size={28} />}
        />
      </div>

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <div>
          <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
            <Activity size={22} className="text-success-500" />
            Active Operator Sessions
          </h2>
          <DataTable columns={sessionColumns} data={activeSessions} />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DefectRateTrendChart data={defectRateTrend} height={220} />
        <YieldTrendChart data={yieldTrend} height={220} />
        <div className="grid grid-rows-2 gap-4">
          <DefectsBarChart data={defectsByInspection} height={100} />
          <DistributionPieChart data={distributionData} height={100} />
        </div>
      </div>

      {/* Inspection Results Table */}
      <div>
        <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3 underline underline-offset-4 decoration-2">
          Recent Inspection Results
        </h2>
        <DataTable columns={inspectionColumns} data={recentInspections} />
      </div>
    </div>
  );
}
