 "use client";

import React, { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, DataTable, Badge, KPICard, LoadingSpinner, Button } from "@/components/ui";
import { formatDuration, exportToCsv } from "@/lib/utils";
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
  CheckCircle2, AlertTriangle, TrendingUp, ScanBarcode, Package, Download,
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

interface PartReferenceItem {
  id: string;
  partNumber: string;
  barcode: string;
  estimatedTime: number;
  deadline: string;
  quantity: number;
  status: string;
  machineType?: string | null;
  machine?: { id: string; name: string; type: string; status: string } | null;
  inspector?: { id: string; name: string; email: string } | null;
  uploadedBy: { id: string; name: string; email: string };
  createdAt: string;
}

interface ProcessedPart {
  id: string;
  partNumber: string;
  scannedBarcode: string | null;
  status: string;
  operatorResult: string | null;
  qaDecision: string | null;
  machineName: string;
  machineType: string;
  operatorName: string;
  inspectorName: string | null;
  createdAt: string;
  qaReviewedAt: string | null;
  operatorTimeIn: string | null;
  operatorTimeOut: string | null;
  estimatedTime: number | null;
  deadline: string | null;
  quantity: number | null;
  priority: string | null;
  inspectorTimeIn: string | null;
  inspectorTimeOut: string | null;
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
  const [partReferences, setPartReferences] = useState<PartReferenceItem[]>([]);
  const [allProcessedParts, setAllProcessedParts] = useState<ProcessedPart[]>([]);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const sessionStartRef = useRef<number>(Date.now() - 30 * 60 * 1000);

  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch analytics + timing + part references + inspections in parallel
      const [analyticsRes, timingRes, partRefRes, inspectionsRes] = await Promise.all([
        fetch("/api/analytics?period=7d"),
        fetch("/api/analytics/timing"),
        fetch("/api/admin/barcode-reference"),
        fetch("/api/inspections?limit=200"),
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
          avgQueueTime: timingData.data.summary?.avgOperatorTime ?? null,
          avgInspectionTime: timingData.data.summary?.avgInspectionTime ?? null,
          totalCycleTime: timingData.data.summary?.totalCycleTime ?? null,
        });
        // Map active sessions (timing API returns flat fields, not nested objects)
        const sessions: ActiveSession[] = (timingData.data.activeSessions || []).map((s: any) => ({
          id: s.id,
          operatorName: s.operatorName || "-",
          machineName: s.machineName || "-",
          machineType: s.machineType || "-",
          startTime: s.startTime,
          itemsCompleted: s.itemsCompleted,
          status: s.status,
        }));
        setActiveSessions(sessions);
      }

      // Part references — only show PENDING (not yet scanned by operator)
      if (partRefRes.ok) {
        const partRefData = await partRefRes.json();
        const pending = (partRefData.data || []).filter((r: PartReferenceItem) => r.status === "PENDING" || !r.status);
       

      // All processed (non-PENDING) parts for charts and completed summary
      if (inspectionsRes.ok) {
        const inspData = await inspectionsRes.json();
        const parts: ProcessedPart[] = (inspData.data || []).map((p: any) => ({
          id: p.id,
          partNumber: p.partNumber || "-",
          scannedBarcode: p.scannedBarcode || null,
          status: p.status,
          operatorResult: p.result || null,         // route aliases operatorResult as "result"
          qaDecision: p.qaDecision || null,
          machineName: p.machine?.name || "-",
          machineType: p.machine?.type || "-",
          operatorName: p.operatorName || "-",      // route returns flat operatorName
          inspectorName: p.qaReviewerName || null,  // route returns qaReviewerName
          createdAt: p.createdAt,
          qaReviewedAt: p.qaReviewedAt || p.inspectionCompletedAt || null,
          operatorTimeIn: p.operatorStartedAt || null,
          operatorTimeOut: p.operatorCompletedAt || null,
          estimatedTime: p.estimatedTime ?? null,
          deadline: p.deadline ?? null,
          quantity: p.quantity ?? null,
          priority: p.priority ?? null,
          inspectorTimeIn: p.inspectionStartedAt || null,
          inspectorTimeOut: p.inspectionCompletedAt || null,
        }));
        setAllProcessedParts(parts);
      } setPartReferences(pending);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadingCsv(true);
    try {
      const res = await fetch("/api/admin/barcode-reference?download=template");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "barcode-reference-template.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("CSV download failed:", e);
    } finally {
      setDownloadingCsv(false);
    }
  };

  // Chart data computed from real inspections
  const dayMs = 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  const yieldTrend = Array.from({ length: 10 }, (_, i) => {
    const dayEnd = nowMs - (9 - i) * dayMs;
    const dayStart = dayEnd - dayMs;
    const dayLabel = new Date(dayStart).toLocaleDateString("en", { weekday: "short" });
    const items = allProcessedParts.filter(p => {
      const t = new Date(p.createdAt).getTime();
      return t >= dayStart && t < dayEnd;
    });
    const reviewed = items.filter(p => p.qaDecision).length;
    const approved = items.filter(p => p.qaDecision === "APPROVED").length;
    return { label: dayLabel, value: reviewed > 0 ? approved / reviewed : 0 };
  });

  const machineTypes = ["VMM", "CMM"];
  const defectRateTrend = machineTypes.map(type => {
    const items = allProcessedParts.filter(p => p.machineType === type);
    const defects = items.filter(p => p.qaDecision === "CONFIRMED_REJECT" || p.qaDecision === "OVERRIDE_ACCEPT").length;
    return { label: type, value: items.length > 0 ? Math.round((defects / items.length) * 1000) / 10 : 0 };
  });
    const totalDefects = allProcessedParts.filter(p => p.qaDecision === "CONFIRMED_REJECT" || p.qaDecision === "OVERRIDE_ACCEPT" || p.qaDecision === "SCRAP").length;
  const overallRate = allProcessedParts.length > 0 ? Math.round((totalDefects / allProcessedParts.length) * 1000) / 10 : 0;
  defectRateTrend.push({ label: "Overall", value: overallRate });

  const defectsByInspection = machineTypes.map(type => {
    const items = allProcessedParts.filter(p => p.machineType === type);
    const defects = items.filter(p => p.qaDecision === "CONFIRMED_REJECT").length;
    return { label: type, value: defects };
  });

  const totalParts = allProcessedParts.length;
  const passedCount = allProcessedParts.filter(p => p.qaDecision === "APPROVED").length;    const scrapCount = allProcessedParts.filter(p => p.qaDecision === "SCRAP").length;
    const reworkCount = allProcessedParts.filter(p => p.qaDecision === "REWORK").length;  const failedCount = allProcessedParts.filter(p => p.qaDecision === "CONFIRMED_REJECT").length;
  const pendingCount = totalParts - passedCount - failedCount - scrapCount - reworkCount;
  const distributionData = [
    { name: "Approved", value: passedCount, color: "#1e40af" },
    { name: "Rejected", value: failedCount, color: "#dc2626" },
    { name: "Scrap", value: scrapCount, color: "#991b1b" },
    { name: "Rework", value: reworkCount, color: "#d97706" },
    { name: "Pending/Other", value: pendingCount, color: "#94a3b8" },
  ].filter(d => d.value > 0);

  const inspectionColumns = [
    {
      key: "partNumber",
      header: "Part No.",
      className: "font-bold",
      render: (item: any) => item.partNumber || "-",
    },
    {
      key: "operatorResult",
      header: "Status",
      render: (item: any) => {
        const result = item.operatorResult;
        if (!result) return <span className="text-gray-400">—</span>;
        return (
          <Badge variant={result === "ACCEPTED" ? "success" : "danger"}>
            {result}
          </Badge>
        );
      },
    },
    {
      key: "machine",
      header: "Machine",
      render: (item: any) => item.machine?.name || item.machine?.type || "-",
    },
    {
      key: "operator",
      header: "Operator",
      render: (item: any) => item.operator?.name || "-",
    },
    {
      key: "qaDecision",
      header: "QA Decision",
      render: (item: any) => {
        if (!item.qaDecision) return <Badge variant="warning">Pending</Badge>;
        const variant = item.qaDecision === "APPROVED" ? "success"
          : item.qaDecision === "SCRAP" || item.qaDecision === "CONFIRMED_REJECT" ? "danger"
          : item.qaDecision === "REWORK" ? "warning"
          : "info";
        return <Badge variant={variant}>{item.qaDecision.replace(/_/g, " ")}</Badge>;
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

  const partRefColumns = [
    { key: "partNumber", header: "Part No.", className: "font-bold" },
    { key: "barcode", header: "Barcode", render: (item: PartReferenceItem) => <span className="font-mono text-sm">{item.barcode}</span> },
    { key: "estimatedTime", header: "Est. Time", render: (item: PartReferenceItem) => `${item.estimatedTime} min` },
    { key: "deadline", header: "Deadline", render: (item: PartReferenceItem) => new Date(item.deadline).toLocaleDateString() },
    { key: "quantity", header: "Qty", render: (item: PartReferenceItem) => <span className="font-bold">{item.quantity}</span> },
    {
      key: "machine",
      header: "Machine Type",
      render: (item: PartReferenceItem) => {
        const type = item.machineType || item.machine?.type;
        return type
          ? <Badge variant={type === "VMM" ? "info" : "warning"}>{type}</Badge>
          : <span className="text-gray-400">—</span>;
      },
    },
    {
      key: "inspector",
      header: "Inspector",
      render: (item: PartReferenceItem) => item.inspector?.name || <span className="text-gray-400">—</span>,
    },
    {
      key: "priority",
      header: "Priority",
      render: (item: PartReferenceItem) => {
        const hoursToDeadline = (new Date(item.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
        const urgencyScore = Math.max(0, 100 - hoursToDeadline / 2);
        const complexityScore = (item.estimatedTime / 60) * 50 + (item.quantity / 10) * 50;
        const fitness = urgencyScore * 0.6 + complexityScore * 0.4;
        const priority = (fitness > 70 || hoursToDeadline < 24) ? "HIGH"
          : (fitness > 40 || hoursToDeadline < 72) ? "MEDIUM" : "LOW";
        const variant = priority === "HIGH" ? "danger" : priority === "MEDIUM" ? "warning" : "info";
        return <Badge variant={variant}>{priority}</Badge>;
      },
    },
  ];

  const processedPartsColumns = [
    { key: "partNumber", header: "Part No.", className: "font-bold" },
    { key: "operatorName", header: "Operator", className: "font-bold" },
    {
      key: "operatorResult",
      header: "Op. Result",
      render: (item: ProcessedPart) =>
        item.operatorResult
          ? <Badge variant={item.operatorResult === "ACCEPTED" ? "success" : "danger"}>{item.operatorResult}</Badge>
          : <span className="text-gray-400">—</span>,
    },
    {
      key: "operatorTimeIn",
      header: "Op. Time In",
      render: (item: ProcessedPart) =>
        item.operatorTimeIn ? new Date(item.operatorTimeIn).toLocaleTimeString() : "—",
    },
    {
      key: "operatorTimeOut",
      header: "Op. Time Out",
      render: (item: ProcessedPart) =>
        item.operatorTimeOut ? new Date(item.operatorTimeOut).toLocaleTimeString() : "—",
    },
    {
      key: "scannedBarcode",
      header: "Barcode",
      render: (item: ProcessedPart) => (
        <span className="font-mono text-sm">{item.scannedBarcode || "—"}</span>
      ),
    },
    {
      key: "estimatedTime",
      header: "Est. Time",
      render: (item: ProcessedPart) =>
        item.estimatedTime ? `${item.estimatedTime} min` : "—",
    },
    {
      key: "deadline",
      header: "Deadline",
      render: (item: ProcessedPart) =>
        item.deadline ? new Date(item.deadline).toLocaleDateString() : "—",
    },
    {
      key: "quantity",
      header: "Qty",
      render: (item: ProcessedPart) =>
        item.quantity ? <span className="font-bold">{item.quantity}</span> : "—",
    },
    {
      key: "machineType",
      header: "Machine Type",
      render: (item: ProcessedPart) => (
        <Badge variant={item.machineType === "VMM" ? "info" : "warning"}>{item.machineType}</Badge>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (item: ProcessedPart) => {
        const p = item.priority || "LOW";
        const v = p === "HIGH" ? "danger" : p === "MEDIUM" ? "warning" : "info";
        return <Badge variant={v}>{p}</Badge>;
      },
    },
    {
      key: "qaDecision",
      header: "Inspector Result",
      render: (item: ProcessedPart) => {
        if (!item.qaDecision) return <Badge variant="warning">Pending</Badge>;
        const v = item.qaDecision === "APPROVED" ? "success"
          : item.qaDecision === "SCRAP" || item.qaDecision === "CONFIRMED_REJECT" ? "danger"
          : item.qaDecision === "REWORK" ? "warning"
          : "info";
        return <Badge variant={v}>{item.qaDecision.replace(/_/g, " ")}</Badge>;
      },
    },
    {
      key: "inspectorTimeIn",
      header: "Insp. Time In",
      render: (item: ProcessedPart) =>
        item.inspectorTimeIn ? new Date(item.inspectorTimeIn).toLocaleTimeString() : "—",
    },
    {
      key: "inspectorTimeOut",
      header: "Insp. Time Out",
      render: (item: ProcessedPart) =>
        item.inspectorTimeOut ? new Date(item.inspectorTimeOut).toLocaleTimeString() : "—",
    },
    {
      key: "queueTime",
      header: "Queue Time",
      render: (item: ProcessedPart) => {
        if (!item.operatorTimeOut || !item.inspectorTimeIn) return "—";
        const ms = new Date(item.inspectorTimeIn).getTime() - new Date(item.operatorTimeOut).getTime();
        if (ms < 0) return "—";
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        return <span className="font-mono text-sm">{mins}m {secs}s</span>;
      },
    },
    {
      key: "processingTime",
      header: "Processing Time",
      render: (item: ProcessedPart) => {
        if (!item.inspectorTimeIn || !item.inspectorTimeOut) return "—";
        const ms = new Date(item.inspectorTimeOut).getTime() - new Date(item.inspectorTimeIn).getTime();
        if (ms < 0) return "—";
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        return <span className="font-mono text-sm">{mins}m {secs}s</span>;
      },
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
          value={timing.avgQueueTime ? formatDuration(timing.avgQueueTime) : "—"}
          icon={<Timer size={28} />}
        />
        <KPICard
          title="Avg Review Time"
          value={timing.avgInspectionTime ? formatDuration(timing.avgInspectionTime) : "—"}
          icon={<Clock size={28} />}
        />
        <KPICard
          title="Total Cycle Time"
          value={timing.totalCycleTime ? formatDuration(timing.totalCycleTime) : "—"}
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

      {/* Part Reference Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 flex items-center gap-2">
            <Package size={22} className="text-primary-600" />
            Part Reference Table
            <Badge variant="info" className="ml-2">{partReferences.filter(r => new Date(r.createdAt).getTime() >= sessionStartRef.current).length} pending</Badge>
          </h2>
          <Button
            variant="outline"
            size="sm"
            icon={<Download size={16} />}
            onClick={handleDownloadTemplate}
            loading={downloadingCsv}
            disabled={downloadingCsv}
            className="font-bold"
          >
            Download CSV Template
          </Button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Parts awaiting operator scan. Fill the CSV template and upload to add new parts.
        </p>
        <DataTable columns={partRefColumns} data={partReferences.filter(r => new Date(r.createdAt).getTime() >= sessionStartRef.current)} emptyMessage="No pending parts. Download the CSV template, fill it in, and upload to add parts." />
      </div>

      {/* Processed & Inspected Parts Summary Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 flex items-center gap-2">
            <CheckCircle2 size={22} className="text-success-500" />
            Processed &amp; Inspected Parts
            <Badge variant="success" className="ml-2">{allProcessedParts.filter(p => p.status === "COMPLETED").length} completed</Badge>
            <Badge variant="warning" className="ml-1">{allProcessedParts.filter(p => p.status === "OPERATOR_DONE").length} awaiting QA</Badge>
          </h2>
          <Button
            variant="outline"
            size="sm"
            icon={<Download size={16} />}
            onClick={() => {
              const csvRows = allProcessedParts.map(p => ({
                "Part No.": p.partNumber,
                Operator: p.operatorName,
                "Op. Result": p.operatorResult || "",
                "Op. Time In": p.operatorTimeIn ? new Date(p.operatorTimeIn).toLocaleString() : "",
                "Op. Time Out": p.operatorTimeOut ? new Date(p.operatorTimeOut).toLocaleString() : "",
                Barcode: p.scannedBarcode || "",
                "Est. Time": p.estimatedTime ? `${p.estimatedTime} min` : "",
                Deadline: p.deadline ? new Date(p.deadline).toLocaleDateString() : "",
                Qty: p.quantity ?? "",
                "Machine Type": p.machineType,
                Priority: p.priority || "",
                "QA Decision": p.qaDecision || "Pending",
                Inspector: p.inspectorName || "",
                "Insp. Time In": p.inspectorTimeIn ? new Date(p.inspectorTimeIn).toLocaleString() : "",
                "Insp. Time Out": p.inspectorTimeOut ? new Date(p.inspectorTimeOut).toLocaleString() : "",
              }));
              exportToCsv("processed-parts.csv", csvRows);
            }}
            className="font-bold"
          >
            Download CSV
          </Button>
        </div>
        <DataTable
          columns={processedPartsColumns}
          data={allProcessedParts}
          emptyMessage="No parts have been processed yet."
        />
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
