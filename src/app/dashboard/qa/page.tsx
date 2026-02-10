"use client";

import React, { useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Button, Badge, DataTable, KPICard, Modal } from "@/components/ui";
import { DefectRateTrendChart, YieldTrendChart } from "@/components/charts";
import {
  Shield, CheckCircle2, AlertTriangle,
  Eye, RotateCcw, FileSearch,
} from "lucide-react";

// ============================================================
// Mock Data
// ============================================================

const mockDefectTrend = [
  { label: "Week 1", value: 3.2 },
  { label: "Week 2", value: 2.8 },
  { label: "Week 3", value: 2.5 },
  { label: "Week 4", value: 2.1 },
  { label: "Week 5", value: 1.9 },
  { label: "Week 6", value: 2.0 },
];

const mockFlaggedInspections = [
  { id: "1", partNumber: "PN1001", inspector: "J. Dela Cruz", result: "REJECTED", machine: "VMM-1", time: "19 min", reason: "Dimensional deviation" },
  { id: "2", partNumber: "PN1007", inspector: "A. Santos", result: "REJECTED", machine: "CMM-2", time: "28 min", reason: "Surface defect" },
  { id: "3", partNumber: "PN1015", inspector: "V. De Jose", result: "REJECTED", machine: "VMM-3", time: "15 min", reason: "Material non-conformance" },
];

const mockOverrideHistory = [
  {
    id: "1",
    date: "Jan 23, 2026",
    partNumber: "PN0998",
    inspector: "J. Dela Cruz",
    originalResult: "REJECTED",
    qaDecision: "OVERRIDE_ACCEPT",
    justification: "Within tolerance after re-measurement",
  },
  {
    id: "2",
    date: "Jan 22, 2026",
    partNumber: "PN0995",
    inspector: "V. De Jose",
    originalResult: "ACCEPTED",
    qaDecision: "OVERRIDE_REJECT",
    justification: "Hidden crack detected during review",
  },
];

const mockKPIs = {
  totalReviews: 156,
  overrideRate: "4.2%",
  accuracy: "97.8%",
  pendingReviews: 3,
};

// ============================================================
// QA/QC Dashboard
// ============================================================

export default function QADashboardPage() {
  const { data: session } = useSession();
  const [reviewModal, setReviewModal] = useState<{ open: boolean; inspection: (typeof mockFlaggedInspections)[0] | null }>({
    open: false,
    inspection: null,
  });
  const [justification, setJustification] = useState("");

  if (session?.user?.role !== "QA_QC") {
    redirect("/dashboard");
  }

  const handleReview = (inspection: (typeof mockFlaggedInspections)[0]) => {
    setReviewModal({ open: true, inspection });
    setJustification("");
  };

  const handleOverride = (_decision: "APPROVE" | "OVERRIDE") => {
    // Will connect to API
    setReviewModal({ open: false, inspection: null });
    setJustification("");
  };

  const flaggedColumns = [
    { key: "partNumber", header: "Part No.", className: "font-bold" },
    { key: "inspector", header: "Inspector" },
    {
      key: "result",
      header: "Result",
      render: (item: (typeof mockFlaggedInspections)[0]) => (
        <Badge variant="danger">{item.result}</Badge>
      ),
    },
    { key: "machine", header: "Machine" },
    { key: "time", header: "Queue Time" },
    { key: "reason", header: "Reason" },
    {
      key: "action",
      header: "Action",
      render: (item: (typeof mockFlaggedInspections)[0]) => (
        <Button size="sm" variant="primary" icon={<Eye size={14} />} onClick={() => handleReview(item)}>
          Review
        </Button>
      ),
    },
  ];

  const overrideColumns = [
    { key: "date", header: "Date" },
    { key: "partNumber", header: "Part No.", className: "font-bold" },
    { key: "inspector", header: "Inspector" },
    {
      key: "originalResult",
      header: "Original",
      render: (item: (typeof mockOverrideHistory)[0]) => (
        <Badge variant={item.originalResult === "REJECTED" ? "danger" : "success"}>
          {item.originalResult}
        </Badge>
      ),
    },
    {
      key: "qaDecision",
      header: "QA Decision",
      render: (item: (typeof mockOverrideHistory)[0]) => (
        <span className="text-primary-700 font-bold text-xs">{item.qaDecision}</span>
      ),
    },
    { key: "justification", header: "Justification", className: "max-w-[200px] truncate" },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard title="Total Reviews" value={String(mockKPIs.totalReviews)} icon={<FileSearch size={28} />} />
        <KPICard title="Override Rate" value={mockKPIs.overrideRate} icon={<RotateCcw size={28} />} />
        <KPICard title="Inspection Accuracy" value={mockKPIs.accuracy} icon={<CheckCircle2 size={28} />} variant="highlight" />
        <KPICard title="Pending Reviews" value={String(mockKPIs.pendingReviews)} icon={<AlertTriangle size={28} />} />
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
        <DataTable columns={flaggedColumns} data={mockFlaggedInspections} />
      </div>

      {/* Override History */}
      <div>
        <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
          <Shield size={22} className="text-primary-600" />
          Override History
        </h2>
        <DataTable columns={overrideColumns} data={mockOverrideHistory} />
      </div>

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
              <div className="col-span-2">
                <p className="text-xs text-gray-500 font-bold uppercase">Reason</p>
                <p className="font-medium">{reviewModal.inspection.reason}</p>
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
