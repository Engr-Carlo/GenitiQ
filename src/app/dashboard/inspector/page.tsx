"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, Button, Badge, DataTable, KPICard, Modal, LoadingSpinner } from "@/components/ui";
import { DefectRateTrendChart, YieldTrendChart } from "@/components/charts";
import {
  ClipboardCheck, Clock, CheckCircle2, XCircle,
  AlertTriangle, Timer, TrendingUp, ListChecks,
  Shield, Eye, RotateCcw, FileSearch,
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

interface Inspection {
  id: string;
  partNumber: string;
  inspector: string;
  result: string;
  machine: string;
  reason?: string;
  qaDecision?: string;
  qaJustification?: string;
  createdAt: string;
}

// ============================================================
// Inspector Dashboard (merged with QA/QC)
// ============================================================

export default function InspectorDashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [flaggedInspections, setFlaggedInspections] = useState<Inspection[]>([]);
  const [reviewModal, setReviewModal] = useState<{ open: boolean; inspection: Inspection | null }>({
    open: false,
    inspection: null,
  });
  const [justification, setJustification] = useState("");
  const [activeTab, setActiveTab] = useState<"inspections" | "qa">("inspections");
  
  // KPIs
  const [kpis, setKpis] = useState({
    totalInspections: 0,
    passRate: "0%",
    avgTime: "0 min",
    todayCompleted: 0,
    totalReviews: 0,
    overrideRate: "0%",
    accuracy: "0%",
    pendingReviews: 0,
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
      // Fetch queue
      const queueRes = await fetch("/api/queue?status=WAITING");
      const queueData = await queueRes.json();
      const formattedQueue = queueData.data.map((item: any, index: number) => ({
        id: item.id,
        position: index + 1,
        partNumber: item.part.partNumber,
        priority: item.priority,
        estimatedTime: item.estimatedTime,
        machine: item.machine,
        status: index === 0 ? "Next" : "Queued",
      }));
      setQueue(formattedQueue);

      // Fetch inspections
      const inspectionsRes = await fetch("/api/inspections?limit=50");
      const inspectionsData = await inspectionsRes.json();
      const formattedInspections = inspectionsData.data.map((item: any) => ({
        id: item.id,
        partNumber: item.part.partNumber,
        inspector: item.inspector.name,
        result: item.result,
        machine: item.machine.name,
        qaDecision: item.qaDecision,
        qaJustification: item.qaJustification,
        createdAt: new Date(item.createdAt).toLocaleDateString(),
      }));
      setInspections(formattedInspections);

      // Filter flagged (rejected) inspections that need review
      const flagged = formattedInspections.filter(
        (item: Inspection) => item.result === "REJECTED" && !item.qaDecision
      );
      setFlaggedInspections(flagged);

      // Calculate KPIs
      const total = inspectionsData.data.length;
      const passed = inspectionsData.data.filter((i: any) => i.result === "ACCEPTED").length;
      const today = new Date().toDateString();
      const todayCount = inspectionsData.data.filter(
        (i: any) => new Date(i.createdAt).toDateString() === today
      ).length;
      const withReview = inspectionsData.data.filter((i: any) => i.qaDecision).length;
      const overrides = inspectionsData.data.filter(
        (i: any) => i.qaDecision && i.qaDecision.startsWith("OVERRIDE")
      ).length;

      setKpis({
        totalInspections: total,
        passRate: total > 0 ? `${((passed / total) * 100).toFixed(1)}%` : "0%",
        avgTime: "18.2 min", // TODO: Calculate from actual data if timestamps available
        todayCompleted: todayCount,
        totalReviews: withReview,
        overrideRate: withReview > 0 ? `${((overrides / withReview) * 100).toFixed(1)}%` : "0%",
        accuracy: total > 0 ? `${((passed / total) * 100).toFixed(1)}%` : "0%",
        pendingReviews: flagged.length,
      });
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (inspection: Inspection) => {
    setReviewModal({ open: true, inspection });
    setJustification("");
  };

  const handleOverride = async (decision: "APPROVE" | "OVERRIDE") => {
    if (!reviewModal.inspection || !justification) return;

    try {
      const qaDecision = decision === "APPROVE" ? "APPROVED" : "OVERRIDE_ACCEPT";
      const response = await fetch(`/api/inspections/${reviewModal.inspection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qaDecision,
          qaJustification: justification,
        }),
      });

      if (response.ok) {
        setReviewModal({ open: false, inspection: null });
        setJustification("");
        fetchData(); // Refresh data
      }
    } catch (error) {
      console.error("Error submitting QA review:", error);
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
      render: (item: QueueItem) => `${item.estimatedTime} min`
    },
    { 
      key: "machine", 
      header: "Machine",
      render: (item: QueueItem) => item.machine.name
    },
    {
      key: "status",
      header: "Status",
      render: (item: QueueItem) =>
        item.status === "Next" ? (
          <Badge variant="success">Next</Badge>
        ) : (
          <Badge variant="gray">Queued</Badge>
        ),
    },
  ];

  const flaggedColumns = [
    { key: "partNumber", header: "Part No.", className: "font-bold" },
    { key: "inspector", header: "Inspector" },
    {
      key: "result",
      header: "Result",
      render: (item: Inspection) => (
        <Badge variant="danger">{item.result}</Badge>
      ),
    },
    { key: "machine", header: "Machine" },
    { key: "createdAt", header: "Date" },
    {
      key: "action",
      header: "Action",
      render: (item: Inspection) => (
        <Button size="sm" variant="primary" icon={<Eye size={14} />} onClick={() => handleReview(item)}>
          Review
        </Button>
      ),
    },
  ];

  const overrideHistoryColumns = [
    { key: "createdAt", header: "Date" },
    { key: "partNumber", header: "Part No.", className: "font-bold" },
    { key: "inspector", header: "Inspector" },
    {
      key: "result",
      header: "Original",
      render: (item: Inspection) => (
        <Badge variant={item.result === "REJECTED" ? "danger" : "success"}>
          {item.result}
        </Badge>
      ),
    },
    {
      key: "qaDecision",
      header: "QA Decision",
      render: (item: Inspection) => (
        <span className="text-primary-700 font-bold text-xs">{item.qaDecision}</span>
      ),
    },
    { 
      key: "qaJustification", 
      header: "Justification", 
      className: "max-w-[200px] truncate",
      render: (item: Inspection) => item.qaJustification || "-"
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const mockDefectTrend = [
    { label: "Week 1", value: 3.2 },
    { label: "Week 2", value: 2.8 },
    { label: "Week 3", value: 2.5 },
    { label: "Week 4", value: 2.1 },
    { label: "Week 5", value: 1.9 },
    { label: "Week 6", value: 2.0 },
  ];

  const overrideHistory = inspections.filter((i) => i.qaDecision);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("inspections")}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === "inspections"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <ClipboardCheck size={18} className="inline mr-2" />
          Inspections
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
          Quality Control
        </button>
      </div>

      {/* Inspections Tab */}
      {activeTab === "inspections" && (
        <>
          {/* Performance KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard
              title="Total Inspections"
              value={String(kpis.totalInspections)}
              icon={<ClipboardCheck size={28} />}
            />
            <KPICard
              title="Pass Rate"
              value={kpis.passRate}
              icon={<TrendingUp size={28} />}
              variant="highlight"
            />
            <KPICard
              title="Avg. Inspection Time"
              value={kpis.avgTime}
              icon={<Timer size={28} />}
            />
            <KPICard
              title="Completed Today"
              value={String(kpis.todayCompleted)}
              icon={<CheckCircle2 size={28} />}
            />
          </div>

          {/* GA-Optimized Queue */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 flex items-center gap-2">
                <ListChecks size={22} className="text-primary-600" />
                GA-Optimized Inspection Queue
              </h2>
            </div>
            <DataTable columns={queueColumns} data={queue} />
          </div>
        </>
      )}

      {/* QA Tab */}
      {activeTab === "qa" && (
        <>
          {/* QA KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KPICard title="Total Reviews" value={String(kpis.totalReviews)} icon={<FileSearch size={28} />} />
            <KPICard title="Override Rate" value={kpis.overrideRate} icon={<RotateCcw size={28} />} />
            <KPICard title="Inspection Accuracy" value={kpis.accuracy} icon={<CheckCircle2 size={28} />} variant="highlight" />
            <KPICard title="Pending Reviews" value={String(kpis.pendingReviews)} icon={<AlertTriangle size={28} />} />
          </div>

          {/* Defect Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DefectRateTrendChart data={mockDefectTrend} title="Weekly Defect Trend (%)" height={220} />
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

          {/* Flagged Inspections */}
          <div>
            <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle size={22} className="text-warning-500" />
              Flagged Inspections - Pending Review
            </h2>
            <DataTable columns={flaggedColumns} data={flaggedInspections} />
          </div>

          {/* Override History */}
          <div>
            <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
              <Shield size={22} className="text-primary-600" />
              Override History
            </h2>
            <DataTable columns={overrideHistoryColumns} data={overrideHistory} />
          </div>
        </>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={reviewModal.open}
        onClose={() => setReviewModal({ open: false, inspection: null })}
        title="Inspection Review"
        size="lg"
      >
        {reviewModal.inspection && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Part Number</p>
                <p className="text-lg font-black">{reviewModal.inspection.partNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Inspector</p>
                <p className="text-lg font-bold">{reviewModal.inspection.inspector}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Machine</p>
                <p className="font-medium">{reviewModal.inspection.machine}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Result</p>
                <Badge variant="danger">{reviewModal.inspection.result}</Badge>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Justification <span className="text-danger-500">*</span>
              </label>
              <textarea
                className="input-field min-h-[100px] resize-none"
                placeholder="Enter justification for your decision..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="success"
                icon={<CheckCircle2 size={18} />}
                onClick={() => handleOverride("APPROVE")}
                disabled={!justification}
              >
                Approve (Keep Rejected)
              </Button>
              <Button
                variant="danger"
                icon={<RotateCcw size={18} />}
                onClick={() => handleOverride("OVERRIDE")}
                disabled={!justification}
              >
                Override to Accepted
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
