"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, Button, Badge, DataTable, KPICard, Modal, LoadingSpinner } from "@/components/ui";
import { DefectRateTrendChart, YieldTrendChart } from "@/components/charts";
import {
  ClipboardCheck, Clock, CheckCircle2, XCircle,
  AlertTriangle, Timer, TrendingUp,
  Shield, Eye, RotateCcw, Package, Activity, Cpu, LogIn, LogOut,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface InspectionForReview {
  id: string;
  partNumber: string;
  operatorName: string;
  operatorResult: string;
  machineName: string;
  machineType: string;
  operatorStartedAt: string | null;
  operatorCompletedAt: string | null;
  operatorActualTime: number | null;
  scannedBarcode: string | null;
  notes: string | null;
  createdAt: string;
  qaDecision: string | null;
  qaJustification: string | null;
  inspectionStartedAt: string | null;
  inspectionCompletedAt: string | null;
  inspectionActualTime: number | null;
  partId: string;
  // PartReference enriched fields
  estimatedTime: number | null;
  deadline: string | null;
  quantity: number | null;
  priority: string | null;
}

interface MachineData {
  id: string;
  name: string;
  type: "VMM" | "CMM";
  status: string;
  location?: string | null;
  currentOperator?: { id: string; name: string } | null;
  hasActiveSession?: boolean;
}

interface MachineSession {
  id: string;
  machineId: string;
  startTime: string;
  status: string;
  itemsCompleted: number;
  machine: { id: string; name: string; type: string; status: string };
}

interface MachinePerformance {
  id: string;
  name: string;
  type: string;
  status: string;
  activeOperator: string | null;
  itemsProcessed: number;
  uptime: string;
  sessionStart: string | null;
}

// ============================================================
// Review Timer
// ============================================================

function ReviewTimer({ startedAt }: { startedAt: Date | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;

  return (
    <span className="text-sm font-mono font-bold text-primary-700 bg-primary-50 px-3 py-1 rounded-full">
      <Timer size={14} className="inline mr-1" />
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

// ============================================================
// Session Timer
// ============================================================

function SessionTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  return (
    <div className="text-sm font-mono font-bold text-gray-700">
      {hours > 0 && `${hours}h `}{String(minutes).padStart(2, "0")}m {String(seconds).padStart(2, "0")}s
    </div>
  );
}

// ============================================================
// Inspector Dashboard (merged with QA/QC)
// ============================================================

export default function InspectorDashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [reviewItems, setReviewItems] = useState<InspectionForReview[]>([]);
  const [allInspections, setAllInspections] = useState<InspectionForReview[]>([]);
  const [activeTab, setActiveTab] = useState<"review" | "analytics" | "machines">("review");
  const [machinePerformance, setMachinePerformance] = useState<MachinePerformance[]>([]);

  // Machine management state
  const [machines, setMachines] = useState<MachineData[]>([]);
  const [activeSession, setActiveSession] = useState<MachineSession | null>(null);
  const [reportModal, setReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportShutdown, setReportShutdown] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [checkoutConfirm, setCheckoutConfirm] = useState(false);

  // Review modal state
  const [reviewModal, setReviewModal] = useState<{ open: boolean; inspection: InspectionForReview | null }>({
    open: false,
    inspection: null,
  });
  const [reviewStartedAt, setReviewStartedAt] = useState<Date | null>(null);
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // KPIs
  const [kpis, setKpis] = useState({
    totalInspections: 0,
    passRate: "0%",
    avgOperatorTime: "- min",
    avgReviewTime: "- min",
    todayCompleted: 0,
    pendingReviews: 0,
    totalReviews: 0,
    overrideRate: "0%",
  });

  if (session?.user?.role !== "INSPECTOR") {
    redirect("/dashboard");
  }

  useEffect(() => {
    fetchData();
    fetchSession();
    fetchMachines();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch items needing review (operator completed, no QA decision yet)
      const reviewRes = await fetch("/api/inspections?needsReview=true");
      const reviewData = await reviewRes.json();
      const mapInspection = (item: any): InspectionForReview => ({
        id: item.id,
        partNumber: item.partNumber || "-",
        operatorName: item.operatorName || "-",
        operatorResult: item.result,
        machineName: item.machine?.name || "-",
        machineType: item.machine?.type || "-",
        operatorStartedAt: item.operatorStartedAt,
        operatorCompletedAt: item.operatorCompletedAt,
        operatorActualTime: item.operatorActualTime,
        scannedBarcode: item.scannedBarcode,
        notes: item.notes,
        createdAt: item.createdAt,
        qaDecision: item.qaDecision,
        qaJustification: item.qaJustification,
        inspectionStartedAt: item.inspectionStartedAt,
        inspectionCompletedAt: item.inspectionCompletedAt,
        inspectionActualTime: item.inspectionActualTime,
        partId: item.id,  // PartReference id IS the id
        estimatedTime: item.estimatedTime ?? null,
        deadline: item.deadline ?? null,
        quantity: item.quantity ?? null,
        priority: item.priority ?? null,
      });
      const formattedReview = (reviewData.data || []).map(mapInspection);
      setReviewItems(formattedReview);

      // Fetch all inspections
      const inspectionsRes = await fetch("/api/inspections?limit=50");
      const inspectionsData = await inspectionsRes.json();
      const formattedAll = (inspectionsData.data || []).map(mapInspection);
      setAllInspections(formattedAll);

      // Fetch machine performance data
      const machRes = await fetch("/api/machines");
      const machData = await machRes.json();
      const timingRes = await fetch("/api/analytics/timing");
      const timingData = await timingRes.json();
      const activeSessions = timingData.data?.activeSessions || [];

      const perfData: MachinePerformance[] = (machData.data || []).map((m: any) => {
        const session = activeSessions.find((s: any) => s.machine?.id === m.id);
        const start = session?.startTime ? new Date(session.startTime) : null;
        const uptimeMs = start ? Date.now() - start.getTime() : 0;
        const uptimeH = Math.floor(uptimeMs / 3600000);
        const uptimeM = Math.floor((uptimeMs % 3600000) / 60000);
        return {
          id: m.id,
          name: m.name,
          type: m.type,
          status: m.status,
          activeOperator: session?.operator?.name || null,
          itemsProcessed: session?.itemsCompleted || 0,
          uptime: start ? `${uptimeH}h ${uptimeM}m` : "Offline",
          sessionStart: session?.startTime || null,
        };
      });
      setMachinePerformance(perfData);

      // Calculate KPIs
      const all = inspectionsData.data || [];
      const total = all.length;
      const passed = all.filter((i: InspectionForReview) => i.operatorResult === "ACCEPTED").length;
      const today = new Date().toDateString();
      const todayCount = all.filter((i: InspectionForReview) => new Date(i.createdAt).toDateString() === today).length;
      const withReview = all.filter((i: InspectionForReview) => i.qaDecision).length;
      const overrides = all.filter((i: InspectionForReview) => i.qaDecision && i.qaDecision.startsWith("OVERRIDE")).length;
      const opTimes = all.filter((i: InspectionForReview) => i.operatorActualTime).map((i: InspectionForReview) => i.operatorActualTime!);
      const reviewTimes = all.filter((i: InspectionForReview) => i.inspectionActualTime).map((i: InspectionForReview) => i.inspectionActualTime!);

      setKpis({
        totalInspections: total,
        passRate: total > 0 ? `${((passed / total) * 100).toFixed(1)}%` : "0%",
        avgOperatorTime: opTimes.length > 0 ? `${(opTimes.reduce((a: number, b: number) => a + b, 0) / opTimes.length).toFixed(1)} min` : "- min",
        avgReviewTime: reviewTimes.length > 0 ? `${(reviewTimes.reduce((a: number, b: number) => a + b, 0) / reviewTimes.length).toFixed(1)} min` : "- min",
        todayCompleted: todayCount,
        pendingReviews: formattedReview.length,
        totalReviews: withReview,
        overrideRate: withReview > 0 ? `${((overrides / withReview) * 100).toFixed(1)}%` : "0%",
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartReview = (inspection: InspectionForReview) => {
    const now = new Date();
    setReviewModal({ open: true, inspection });
    setReviewStartedAt(now);
    setJustification("");

    // Mark review as started (sends inspectionStartedAt to API)
    fetch(`/api/inspections/${inspection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionStartedAt: now.toISOString() }),
    }).catch(console.error);
  };

  const handleSubmitReview = async (decision: "APPROVED" | "OVERRIDE_ACCEPT" | "CONFIRMED_REJECT") => {
    if (!reviewModal.inspection || (!justification && decision !== "CONFIRMED_REJECT")) return;
    setSubmitting(true);

    try {
      const qaDecision = decision;
      const response = await fetch(`/api/inspections/${reviewModal.inspection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qaDecision,
          qaJustification: justification || `Confirmed at ${new Date().toISOString()}`,
        }),
      });

      if (response.ok) {
        setReviewModal({ open: false, inspection: null });
        setJustification("");
        setReviewStartedAt(null);
        fetchData();
      }
    } catch (error) {
      console.error("Error submitting QA review:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Machine management functions
  const fetchMachines = async () => {
    try {
      const res = await fetch("/api/machines");
      const data = await res.json();
      setMachines(data.data || []);
    } catch (error) {
      console.error("Error fetching machines:", error);
    }
  };

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/operator/session");
      const data = await res.json();
      setActiveSession(data.data?.session || null);
    } catch (error) {
      console.error("Error fetching session:", error);
    }
  };

  const handleCheckIn = async (machine: MachineData) => {
    try {
      const res = await fetch(`/api/machines/${machine.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        await Promise.all([fetchSession(), fetchMachines()]);
        // No need to change tab, session header will appear automatically
      } else {
        const data = await res.json();
        alert(data.error || "Failed to check in");
      }
    } catch (error) {
      console.error("Failed to check in:", error);
    }
  };

  const handleCheckOut = async () => {
    if (!activeSession) return;
    
    try {
      const res = await fetch(`/api/machines/${activeSession.machineId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        setActiveSession(null);
        setCheckoutConfirm(false);
        await fetchMachines();
      }
    } catch (error) {
      console.error("Failed to check out:", error);
    }
  };

  const handleReportIssue = async () => {
    if (!activeSession || !reportReason.trim()) return;
    
    setReportSubmitting(true);
    try {
      const res = await fetch(`/api/machines/${activeSession.machineId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reportReason,
          requestShutdown: reportShutdown,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setReportModal(false);
        setReportReason("");
        setReportShutdown(false);
        if (reportShutdown) {
          setActiveSession(null);
          await fetchMachines();
        } else {
          alert(data.message || "Issue reported successfully");
        }
      } else {
        alert(data.error || "Failed to report issue");
      }
    } catch (error) {
      console.error("Failed to report issue:", error);
      alert("Failed to report issue");
    } finally {
      setReportSubmitting(false);
    }
  };

  const priorityColors: Record<string, "danger" | "warning" | "info" | "gray"> = {
    HIGH: "danger",
    MEDIUM: "warning",
    LOW: "info",
  };

  // Table 1: QA Review columns
  const reviewColumns = [
    { key: "partNumber", header: "Part No.", className: "font-bold" },
    { key: "operatorName", header: "Operator" },
    {
      key: "operatorResult",
      header: "Op. Result",
      render: (item: InspectionForReview) => (
        <Badge variant={item.operatorResult === "ACCEPTED" ? "success" : "danger"}>
          {item.operatorResult}
        </Badge>
      ),
    },
    {
      key: "operatorStartedAt",
      header: "Op. Time In",
      render: (item: InspectionForReview) =>
        item.operatorStartedAt ? new Date(item.operatorStartedAt).toLocaleTimeString() : "-",
    },
    {
      key: "operatorCompletedAt",
      header: "Op. Time Out",
      render: (item: InspectionForReview) =>
        item.operatorCompletedAt ? new Date(item.operatorCompletedAt).toLocaleTimeString() : "-",
    },
    {
      key: "scannedBarcode",
      header: "Barcode",
      render: (item: InspectionForReview) => (
        <span className="font-mono text-sm">{item.scannedBarcode || "-"}</span>
      ),
    },
    {
      key: "estimatedTime",
      header: "Est. Time",
      render: (item: InspectionForReview) =>
        item.estimatedTime ? `${item.estimatedTime} min` : "-",
    },
    {
      key: "deadline",
      header: "Deadline",
      render: (item: InspectionForReview) =>
        item.deadline ? new Date(item.deadline).toLocaleDateString() : "-",
    },
    {
      key: "quantity",
      header: "Qty",
      render: (item: InspectionForReview) =>
        item.quantity ? <span className="font-bold">{item.quantity}</span> : "-",
    },
    {
      key: "machineType",
      header: "Machine Type",
      render: (item: InspectionForReview) => (
        <Badge variant={item.machineType === "VMM" ? "info" : "warning"}>
          {item.machineType}
        </Badge>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (item: InspectionForReview) => {
        const p = item.priority || "LOW";
        return <Badge variant={priorityColors[p] || "gray"}>{p}</Badge>;
      },
    },
    {
      key: "action",
      header: "Action",
      render: (item: InspectionForReview) => (
        <Button size="sm" variant="primary" icon={<Eye size={14} />} onClick={() => handleStartReview(item)}>
          Review
        </Button>
      ),
    },
  ];

  // Table 3 & 4: Analytics & History / Inspections columns (includes inspector data)
  const historyColumns = [
    { key: "partNumber", header: "Part No.", className: "font-bold" },
    { key: "operatorName", header: "Operator" },
    {
      key: "operatorResult",
      header: "Op. Result",
      render: (item: InspectionForReview) => (
        <Badge variant={item.operatorResult === "ACCEPTED" ? "success" : "danger"}>
          {item.operatorResult}
        </Badge>
      ),
    },
    {
      key: "operatorStartedAt",
      header: "Op. Time In",
      render: (item: InspectionForReview) =>
        item.operatorStartedAt ? new Date(item.operatorStartedAt).toLocaleTimeString() : "-",
    },
    {
      key: "operatorCompletedAt",
      header: "Op. Time Out",
      render: (item: InspectionForReview) =>
        item.operatorCompletedAt ? new Date(item.operatorCompletedAt).toLocaleTimeString() : "-",
    },
    {
      key: "scannedBarcode",
      header: "Barcode",
      render: (item: InspectionForReview) => (
        <span className="font-mono text-sm">{item.scannedBarcode || "-"}</span>
      ),
    },
    {
      key: "estimatedTime",
      header: "Est. Time",
      render: (item: InspectionForReview) =>
        item.estimatedTime ? `${item.estimatedTime} min` : "-",
    },
    {
      key: "deadline",
      header: "Deadline",
      render: (item: InspectionForReview) =>
        item.deadline ? new Date(item.deadline).toLocaleDateString() : "-",
    },
    {
      key: "quantity",
      header: "Qty",
      render: (item: InspectionForReview) =>
        item.quantity ? <span className="font-bold">{item.quantity}</span> : "-",
    },
    {
      key: "machineType",
      header: "Machine Type",
      render: (item: InspectionForReview) => (
        <Badge variant={item.machineType === "VMM" ? "info" : "warning"}>
          {item.machineType}
        </Badge>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (item: InspectionForReview) => {
        const p = item.priority || "LOW";
        return <Badge variant={priorityColors[p] || "gray"}>{p}</Badge>;
      },
    },
    {
      key: "qaDecision",
      header: "Inspector Result",
      render: (item: InspectionForReview) => {
        if (!item.qaDecision) return <Badge variant="warning">Pending</Badge>;
        const variant = item.qaDecision === "APPROVED" ? "success" : item.qaDecision === "CONFIRMED_REJECT" ? "danger" : "info";
        return <Badge variant={variant}>{item.qaDecision.replace("_", " ")}</Badge>;
      },
    },
    {
      key: "inspectionStartedAt",
      header: "Insp. Time In",
      render: (item: InspectionForReview) =>
        item.inspectionStartedAt ? new Date(item.inspectionStartedAt).toLocaleTimeString() : "-",
    },
    {
      key: "inspectionCompletedAt",
      header: "Insp. Time Out",
      render: (item: InspectionForReview) =>
        item.inspectionCompletedAt ? new Date(item.inspectionCompletedAt).toLocaleTimeString() : "-",
    },
  ];

  // Table 5: Machine Performance columns
  const machinePerformanceColumns = [
    { key: "name", header: "Machine", className: "font-bold" },
    {
      key: "type",
      header: "Type",
      render: (item: MachinePerformance) => (
        <Badge variant={item.type === "VMM" ? "info" : "warning"}>{item.type}</Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: MachinePerformance) => {
        const v = item.status === "ACTIVE" ? "success" : item.status === "IDLE" ? "gray" : "danger";
        return <Badge variant={v}>{item.status}</Badge>;
      },
    },
    {
      key: "activeOperator",
      header: "Active Operator",
      render: (item: MachinePerformance) => item.activeOperator || <span className="text-gray-400">—</span>,
    },
    {
      key: "itemsProcessed",
      header: "Items Processed",
      render: (item: MachinePerformance) => <span className="font-bold">{item.itemsProcessed}</span>,
    },
    { key: "uptime", header: "Session Uptime" },
    {
      key: "sessionStart",
      header: "Session Started",
      render: (item: MachinePerformance) =>
        item.sessionStart ? new Date(item.sessionStart).toLocaleTimeString() : "—",
    },
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
      {/* Machine selection - shown when no active session */}
      {!activeSession ? (
        <div className="space-y-6">
          <Card className="bg-gradient-to-r from-primary-50 to-primary-100/50 border-primary-200">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-primary-800 text-white flex items-center justify-center">                <Cpu size={32} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900">Select a Machine</h1>
                <p className="text-gray-600">You must check in to a machine before performing inspections</p>
              </div>
            </div>
          </Card>

          {/* VMM Machines */}
          {machines.filter(m => m.type === "VMM").length > 0 && (
            <div>
              <h3 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3">
                VMM Machines
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {machines.filter(m => m.type === "VMM").map((machine) => (
                  <Card key={machine.id} className="hover:border-primary-400 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <Badge variant="info" className="text-xs mb-1">VMM</Badge>
                        <h4 className="text-lg font-black text-gray-900">{machine.name}</h4>
                        {machine.location && <p className="text-xs text-gray-500">{machine.location}</p>}
                      </div>
                      <Badge variant={
                        machine.status === "SHUTDOWN" || machine.status === "MAINTENANCE" ? "gray" :
                        machine.hasActiveSession ? "danger" : "success"
                      }>
                        {machine.status === "SHUTDOWN" || machine.status === "MAINTENANCE" ? machine.status :
                         machine.hasActiveSession ? "In Use" : "Available"}
                      </Badge>
                    </div>
                    {machine.currentOperator && (
                      <p className="text-xs text-gray-500 mb-3">Used by: {machine.currentOperator.name}</p>
                    )}
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<LogIn size={14} />}
                      onClick={() => handleCheckIn(machine)}
                      disabled={machine.status === "SHUTDOWN" || machine.status === "MAINTENANCE" || machine.hasActiveSession}
                      className="w-full"
                    >
                      {machine.hasActiveSession ? "In Use" : machine.status === "SHUTDOWN" || machine.status === "MAINTENANCE" ? machine.status : "Check In"}
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* CMM Machines */}
          {machines.filter(m => m.type === "CMM").length > 0 && (
            <div>
              <h3 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3">
                CMM Machines
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {machines.filter(m => m.type === "CMM").map((machine) => (
                  <Card key={machine.id} className="hover:border-primary-400 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <Badge variant="warning" className="text-xs mb-1">CMM</Badge>
                        <h4 className="text-lg font-black text-gray-900">{machine.name}</h4>
                        {machine.location && <p className="text-xs text-gray-500">{machine.location}</p>}
                      </div>
                      <Badge variant={
                        machine.status === "SHUTDOWN" || machine.status === "MAINTENANCE" ? "gray" :
                        machine.hasActiveSession ? "danger" : "success"
                      }>
                        {machine.status === "SHUTDOWN" || machine.status === "MAINTENANCE" ? machine.status :
                         machine.hasActiveSession ? "In Use" : "Available"}
                      </Badge>
                    </div>
                    {machine.currentOperator && (
                      <p className="text-xs text-gray-500 mb-3">Used by: {machine.currentOperator.name}</p>
                    )}
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<LogIn size={14} />}
                      onClick={() => handleCheckIn(machine)}
                      disabled={machine.status === "SHUTDOWN" || machine.status === "MAINTENANCE" || machine.hasActiveSession}
                      className="w-full"
                    >
                      {machine.hasActiveSession ? "In Use" : machine.status === "SHUTDOWN" || machine.status === "MAINTENANCE" ? machine.status : "Check In"}
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {machines.length === 0 && (
            <Card className="text-center py-12">
              <Cpu size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-500">No machines available</h3>
              <p className="text-sm text-gray-400 mt-2">Contact admin to add machines</p>
            </Card>
          )}
        </div>
      ) : (
        <>
          {/* Persistent Session Header */}
          <Card className="bg-gradient-to-r from-primary-50 to-primary-100/50 border-primary-200 sticky top-0 z-10 shadow-md">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary-800 text-white flex items-center justify-center">
                  <Cpu size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-gray-900">{activeSession.machine.name}</h2>
                    <Badge variant={activeSession.machine.type === "VMM" ? "info" : "warning"}>
                      {activeSession.machine.type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock size={14} className="text-gray-500" />
                    <SessionTimer startTime={activeSession.startTime} />
                    <span className="text-xs text-gray-500">• {activeSession.itemsCompleted} items completed</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<AlertTriangle size={14} />}
                  onClick={() => setReportModal(true)}
                >
                  Report Issue
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<LogOut size={14} />}
                  onClick={() => setCheckoutConfirm(true)}
                >
                  Check Out
                </Button>
              </div>
            </div>
          </Card>

      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("review")}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === "review"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Package size={18} className="inline mr-2" />
          QA Review
          {kpis.pendingReviews > 0 && (
            <Badge variant="danger" className="ml-2">{kpis.pendingReviews}</Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === "analytics"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Shield size={18} className="inline mr-2" />
          Analytics & History
        </button>
        <button
          onClick={() => setActiveTab("machines")}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === "machines"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Activity size={18} className="inline mr-2" />
          Machine Performance
        </button>
      </div>

      {/* ==================== QA Review Tab ==================== */}
      {activeTab === "review" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard title="Pending Reviews" value={String(kpis.pendingReviews)} icon={<AlertTriangle size={28} />} variant="highlight" />
            <KPICard title="Avg Operator Time" value={kpis.avgOperatorTime} icon={<Timer size={28} />} />
            <KPICard title="Avg Review Time" value={kpis.avgReviewTime} icon={<Clock size={28} />} />
            <KPICard title="Pass Rate" value={kpis.passRate} icon={<TrendingUp size={28} />} />
          </div>

          <div>
            <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
              <Package size={22} className="text-warning-500" />
              Items Awaiting QA Review
            </h2>
            <DataTable
              columns={reviewColumns}
              data={reviewItems}
              emptyMessage="No items pending review — all caught up!"
            />
          </div>
        </>
      )}

      {/* ==================== Inspections Tab (REMOVED) ==================== */}

      {/* ==================== Analytics & History Tab ==================== */}
      {activeTab === "analytics" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard title="Total Inspections" value={String(kpis.totalInspections)} icon={<ClipboardCheck size={28} />} />
            <KPICard title="Override Rate" value={kpis.overrideRate} icon={<RotateCcw size={28} />} />
            <KPICard title="Avg Operator Time" value={kpis.avgOperatorTime} icon={<Timer size={28} />} />
            <KPICard title="Avg Review Time" value={kpis.avgReviewTime} icon={<Clock size={28} />} variant="highlight" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DefectRateTrendChart
              data={[
                { label: "Week 1", value: 3.2 },
                { label: "Week 2", value: 2.8 },
                { label: "Week 3", value: 2.5 },
                { label: "Week 4", value: 2.1 },
                { label: "Week 5", value: 1.9 },
                { label: "Week 6", value: 2.0 },
              ]}
              title="Weekly Defect Trend (%)"
              height={220}
            />
            <YieldTrendChart
              data={[
                { label: "Week 1", value: 96.2 },
                { label: "Week 2", value: 96.8 },
                { label: "Week 3", value: 97.1 },
                { label: "Week 4", value: 97.5 },
                { label: "Week 5", value: 97.8 },
                { label: "Week 6", value: 97.8 },
              ]}
              title="Inspection Accuracy Trend (%)"
              height={220}
            />
          </div>

          {/* Full Inspection History Table (Table 3) */}
          <div>
            <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
              <Shield size={22} className="text-primary-600" />
              Inspection History
            </h2>
            <DataTable columns={historyColumns} data={allInspections} emptyMessage="No inspections recorded yet" />
          </div>
        </>
      )}

      {/* ==================== Machine Performance Tab ==================== */}
      {activeTab === "machines" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard
              title="Total Machines"
              value={String(machinePerformance.length)}
              icon={<Cpu size={28} />}
            />
            <KPICard
              title="Active Machines"
              value={String(machinePerformance.filter(m => m.activeOperator).length)}
              icon={<Activity size={28} />}
              variant="highlight"
            />
            <KPICard
              title="Items Processed"
              value={String(machinePerformance.reduce((sum, m) => sum + m.itemsProcessed, 0))}
              icon={<CheckCircle2 size={28} />}
            />
            <KPICard
              title="Pass Rate"
              value={kpis.passRate}
              icon={<TrendingUp size={28} />}
            />
          </div>

          <div>
            <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
              <Cpu size={22} className="text-primary-600" />
              Real-Time Machine Performance
            </h2>
            <DataTable columns={machinePerformanceColumns} data={machinePerformance} emptyMessage="No machines available" />
          </div>
        </>
      )}
        </>
      )}

      {/* Machine Management Modals */}
      <Modal
        isOpen={reportModal}
        onClose={() => { setReportModal(false); setReportReason(""); setReportShutdown(false); }}
        title="Report Machine Issue"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-warning-50 border border-warning-200">
            <AlertTriangle size={24} className="text-warning-600" />
            <div className="text-sm text-gray-700">
              <p className="font-bold">Report an issue with {activeSession?.machine.name}</p>
              <p className="text-xs text-gray-500">If you request shutdown, your session will end and the machine will be unavailable.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Issue Description *</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              rows={4}
              placeholder="Describe the issue (e.g., Machine making unusual noise, calibration error, etc.)"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200">
            <input
              type="checkbox"
              id="requestShutdown"
              checked={reportShutdown}
              onChange={(e) => setReportShutdown(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="requestShutdown" className="text-sm cursor-pointer">
              <span className="font-bold text-danger-600">Request Immediate Shutdown</span>
              <p className="text-xs text-gray-500 mt-1">
                Machine requires immediate shutdown and cannot be used. Only admins can reactivate it.
              </p>
            </label>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setReportModal(false); setReportReason(""); setReportShutdown(false); }}>
              Cancel
            </Button>
            <Button
              variant={reportShutdown ? "danger" : "primary"}
              onClick={handleReportIssue}
              loading={reportSubmitting}
              disabled={!reportReason.trim()}
            >
              {reportShutdown ? "Shutdown & Report" : "Report Issue"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={checkoutConfirm}
        onClose={() => setCheckoutConfirm(false)}
        title="Confirm Check Out"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to check out from <span className="font-bold">{activeSession?.machine.name}</span>?
          </p>
          <div className="bg-info-50 border border-info-200 rounded-lg p-3">
            <p className="text-sm text-gray-600">
              Items completed: <span className="font-bold">{activeSession?.itemsCompleted || 0}</span>
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setCheckoutConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleCheckOut}>Check Out</Button>
          </div>
        </div>
      </Modal>

      {/* ==================== Review Modal ==================== */}
      <Modal
        isOpen={reviewModal.open}
        onClose={() => { setReviewModal({ open: false, inspection: null }); setReviewStartedAt(null); }}
        title="QA Inspection Review"
        size="lg"
      >
        {reviewModal.inspection && (
          <div className="space-y-4">
            {/* Header with timer */}
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-black text-gray-900">
                {reviewModal.inspection.partNumber}
              </h4>
              <ReviewTimer startedAt={reviewStartedAt} />
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Operator</p>
                <p className="text-sm font-bold">{reviewModal.inspection.operatorName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Machine</p>
                <p className="text-sm font-medium">{reviewModal.inspection.machineName} ({reviewModal.inspection.machineType})</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Operator Result</p>
                <Badge variant={reviewModal.inspection.operatorResult === "ACCEPTED" ? "success" : "danger"}>
                  {reviewModal.inspection.operatorResult}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Operator Time</p>
                <p className="text-sm font-medium">
                  {reviewModal.inspection.operatorActualTime
                    ? `${reviewModal.inspection.operatorActualTime.toFixed(1)} min`
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Barcode</p>
                <p className="text-sm font-mono">{reviewModal.inspection.scannedBarcode || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Submitted</p>
                <p className="text-sm font-medium">{new Date(reviewModal.inspection.createdAt).toLocaleString()}</p>
              </div>
            </div>

            {/* Operator notes */}
            {reviewModal.inspection.notes && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 font-bold uppercase mb-1">Operator Notes</p>
                <p className="text-sm text-gray-700">{reviewModal.inspection.notes}</p>
              </div>
            )}

            {/* Justification */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                QA Notes / Justification
              </label>
              <textarea
                className="input-field min-h-[80px] resize-none"
                placeholder="Enter your review notes..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              {reviewModal.inspection.operatorResult === "ACCEPTED" ? (
                <>
                  <Button
                    variant="success"
                    icon={<CheckCircle2 size={18} />}
                    onClick={() => handleSubmitReview("APPROVED")}
                    loading={submitting}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="danger"
                    icon={<XCircle size={18} />}
                    onClick={() => handleSubmitReview("OVERRIDE_ACCEPT")}
                    loading={submitting}
                    disabled={!justification}
                  >
                    Override → Reject
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="danger"
                    icon={<XCircle size={18} />}
                    onClick={() => handleSubmitReview("CONFIRMED_REJECT")}
                    loading={submitting}
                  >
                    Confirm Rejection
                  </Button>
                  <Button
                    variant="success"
                    icon={<RotateCcw size={18} />}
                    onClick={() => handleSubmitReview("OVERRIDE_ACCEPT")}
                    loading={submitting}
                    disabled={!justification}
                  >
                    Override → Accept
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
