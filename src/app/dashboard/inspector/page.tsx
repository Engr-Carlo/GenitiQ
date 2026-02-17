"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, Button, Badge, DataTable, KPICard, Modal, LoadingSpinner } from "@/components/ui";
import { DefectRateTrendChart, YieldTrendChart } from "@/components/charts";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import {
  ClipboardCheck, Clock, CheckCircle2, XCircle,
  AlertTriangle, Timer, TrendingUp, ListChecks,
  Shield, Eye, RotateCcw, FileSearch, ScanBarcode,
  Play, Package, Activity, Cpu,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface QueueItem {
  id: string;
  position: number;
  partNumber: string;
  priority: string;
  estimatedTime: number;
  machine: { id: string; name: string; type: string };
  status: string;
}

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
// Inspector Dashboard (merged with QA/QC)
// ============================================================

export default function InspectorDashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [reviewItems, setReviewItems] = useState<InspectionForReview[]>([]);
  const [allInspections, setAllInspections] = useState<InspectionForReview[]>([]);
  const [activeTab, setActiveTab] = useState<"review" | "inspections" | "qa">("review");

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
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch items needing review (operator completed, no QA decision yet)
      const reviewRes = await fetch("/api/inspections?needsReview=true");
      const reviewData = await reviewRes.json();
      const formattedReview: InspectionForReview[] = (reviewData.data || []).map((item: any) => ({
        id: item.id,
        partNumber: item.part?.partNumber || "-",
        operatorName: item.inspector?.name || "-",
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
        partId: item.partId,
      }));
      setReviewItems(formattedReview);

      // Fetch all inspections
      const inspectionsRes = await fetch("/api/inspections?limit=50");
      const inspectionsData = await inspectionsRes.json();
      const formattedAll: InspectionForReview[] = (inspectionsData.data || []).map((item: any) => ({
        id: item.id,
        partNumber: item.part?.partNumber || "-",
        operatorName: item.inspector?.name || "-",
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
        partId: item.partId,
      }));
      setAllInspections(formattedAll);

      // Fetch queue
      const queueRes = await fetch("/api/queue?status=WAITING");
      const queueData = await queueRes.json();
      const formattedQueue = (queueData.data || []).map((item: any, index: number) => ({
        id: item.id,
        position: index + 1,
        partNumber: item.part?.partNumber || "-",
        priority: item.priority,
        estimatedTime: item.estimatedTime,
        machine: item.machine,
        status: index === 0 ? "Next" : "Queued",
      }));
      setQueue(formattedQueue);

      // Calculate KPIs
      const all = inspectionsData.data || [];
      const total = all.length;
      const passed = all.filter((i: any) => i.result === "ACCEPTED").length;
      const today = new Date().toDateString();
      const todayCount = all.filter((i: any) => new Date(i.createdAt).toDateString() === today).length;
      const withReview = all.filter((i: any) => i.qaDecision).length;
      const overrides = all.filter((i: any) => i.qaDecision && i.qaDecision.startsWith("OVERRIDE")).length;
      const opTimes = all.filter((i: any) => i.operatorActualTime).map((i: any) => i.operatorActualTime);
      const reviewTimes = all.filter((i: any) => i.inspectionActualTime).map((i: any) => i.inspectionActualTime);

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
      render: (item: QueueItem) => (
        <Badge variant={priorityColors[item.priority]}>{item.priority}</Badge>
      ),
    },
    {
      key: "estimatedTime",
      header: "Est. Time",
      render: (item: QueueItem) => `${item.estimatedTime} min`,
    },
    {
      key: "machine",
      header: "Machine",
      render: (item: QueueItem) => item.machine.name,
    },
    {
      key: "status",
      header: "Status",
      render: (item: QueueItem) =>
        item.status === "Next" ? <Badge variant="success">Next</Badge> : <Badge variant="gray">Queued</Badge>,
    },
  ];

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
    { key: "machineName", header: "Machine" },
    {
      key: "operatorActualTime",
      header: "Op. Time",
      render: (item: InspectionForReview) =>
        item.operatorActualTime ? `${item.operatorActualTime.toFixed(1)} min` : "-",
    },
    {
      key: "createdAt",
      header: "Submitted",
      render: (item: InspectionForReview) => new Date(item.createdAt).toLocaleString(),
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
      key: "qaDecision",
      header: "QA Decision",
      render: (item: InspectionForReview) => {
        if (!item.qaDecision) return <Badge variant="warning">Pending</Badge>;
        const variant = item.qaDecision === "APPROVED" ? "success" : item.qaDecision === "CONFIRMED_REJECT" ? "danger" : "info";
        return <Badge variant={variant}>{item.qaDecision.replace("_", " ")}</Badge>;
      },
    },
    {
      key: "inspectionActualTime",
      header: "Review Time",
      render: (item: InspectionForReview) =>
        item.inspectionActualTime ? `${item.inspectionActualTime.toFixed(1)} min` : "-",
    },
    {
      key: "createdAt",
      header: "Date",
      render: (item: InspectionForReview) => new Date(item.createdAt).toLocaleDateString(),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const overrideHistory = allInspections.filter((i) => i.qaDecision);

  return (
    <div className="space-y-6">
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
          onClick={() => setActiveTab("inspections")}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === "inspections"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <ClipboardCheck size={18} className="inline mr-2" />
          Queue & Inspections
        </button>
        <button
          onClick={() => setActiveTab("qa")}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === "qa"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Shield size={18} className="inline mr-2" />
          Analytics & History
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

      {/* ==================== Inspections Tab ==================== */}
      {activeTab === "inspections" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard title="Total Inspections" value={String(kpis.totalInspections)} icon={<ClipboardCheck size={28} />} />
            <KPICard title="Pass Rate" value={kpis.passRate} icon={<TrendingUp size={28} />} variant="highlight" />
            <KPICard title="Completed Today" value={String(kpis.todayCompleted)} icon={<CheckCircle2 size={28} />} />
            <KPICard title="Total Reviews" value={String(kpis.totalReviews)} icon={<FileSearch size={28} />} />
          </div>

          <div>
            <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
              <ListChecks size={22} className="text-primary-600" />
              GA-Optimized Inspection Queue
            </h2>
            <DataTable columns={queueColumns} data={queue} />
          </div>
        </>
      )}

      {/* ==================== Analytics Tab ==================== */}
      {activeTab === "qa" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard title="Total Reviews" value={String(kpis.totalReviews)} icon={<FileSearch size={28} />} />
            <KPICard title="Override Rate" value={kpis.overrideRate} icon={<RotateCcw size={28} />} />
            <KPICard title="Avg Operator Time" value={kpis.avgOperatorTime} icon={<Timer size={28} />} />
            <KPICard title="Avg Review Time" value={kpis.avgReviewTime} icon={<Clock size={28} />} variant="highlight" />
          </div>

          {/* Defect Trends (mock for now) */}
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

          {/* Review History */}
          <div>
            <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
              <Shield size={22} className="text-primary-600" />
              QA Decision History
            </h2>
            <DataTable columns={historyColumns} data={overrideHistory} emptyMessage="No QA reviews yet" />
          </div>
        </>
      )}

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
