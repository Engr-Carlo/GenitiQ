"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Badge, Button, DataTable, Modal, KPICard, LoadingSpinner } from "@/components/ui";
import {
  FileSearch, CheckCircle2, XCircle, Filter, Download, Eye, RotateCcw,
} from "lucide-react";

// ============================================================
// Types
// ============================================================
interface InspectionRecord {
  id: string;
  partNumber: string;
  operatorName: string | null;
  result: "ACCEPTED" | "REJECTED" | null;
  machine: { id: string; name: string; type: string } | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  qaDecision: string | null;
  qaReviewedAt: string | null;
  qaReviewerName: string | null;
  operatorActualTime: number | null;
  inspectionActualTime: number | null;
  notes: string | null;
}

const resultVariant: Record<string, "success" | "danger"> = {
  ACCEPTED: "success",
  REJECTED: "danger",
};

const qaLabel = (qaDecision: string | null, status: string): string => {
  if (status === "OPERATOR_DONE") return "Pending QA";
  if (!qaDecision) return "—";
  if (qaDecision === "APPROVED") return "Approved";
  if (qaDecision === "OVERRIDE_ACCEPT") return "Override";
  if (qaDecision === "CONFIRMED_REJECT") return "Confirmed";
  if (qaDecision === "RE_INSPECT") return "Re-inspect";
  return qaDecision;
};

const qaLabelClass = (qaDecision: string | null, status: string): string => {
  if (status === "OPERATOR_DONE") return "text-warning-600";
  if (!qaDecision) return "text-gray-400";
  if (qaDecision === "APPROVED") return "text-success-600";
  if (qaDecision === "OVERRIDE_ACCEPT") return "text-primary-600";
  if (qaDecision === "CONFIRMED_REJECT") return "text-danger-600";
  if (qaDecision === "RE_INSPECT") return "text-orange-500";
  return "text-gray-500";
};

export default function InspectionsPage() {
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [filterResult, setFilterResult] = useState<"ALL" | "ACCEPTED" | "REJECTED">("ALL");
  const [detailModal, setDetailModal] = useState<{ open: boolean; inspection: InspectionRecord | null }>({
    open: false,
    inspection: null,
  });

  const fetchInspections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inspections?limit=200");
      const json = await res.json();
      setInspections(json.data || []);
    } catch (e) {
      console.error("Failed to fetch inspections:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInspections(); }, [fetchInspections]);

  const filtered = filterResult === "ALL"
    ? inspections
    : inspections.filter((i) => i.result === filterResult);

  const acceptedCount = inspections.filter((i) => i.result === "ACCEPTED").length;
  const rejectedCount = inspections.filter((i) => i.result === "REJECTED").length;
  const pendingQACount = inspections.filter((i) => i.status === "OPERATOR_DONE").length;

  const columns = [
    { key: "partNumber", header: "Part No.", className: "font-bold" },
    {
      key: "operatorName",
      header: "Operator",
      render: (item: InspectionRecord) => item.operatorName || <span className="text-gray-400">—</span>,
    },
    {
      key: "machine",
      header: "Machine",
      render: (item: InspectionRecord) => item.machine?.name || <span className="text-gray-400">—</span>,
    },
    {
      key: "result",
      header: "Result",
      render: (item: InspectionRecord) =>
        item.result ? (
          <Badge variant={resultVariant[item.result]}>
            {item.result === "ACCEPTED" && <CheckCircle2 size={12} className="inline mr-1" />}
            {item.result === "REJECTED" && <XCircle size={12} className="inline mr-1" />}
            {item.result}
          </Badge>
        ) : (
          <span className="text-gray-400 text-sm">—</span>
        ),
    },
    {
      key: "updatedAt",
      header: "Date",
      render: (item: InspectionRecord) => new Date(item.updatedAt).toLocaleDateString(),
    },
    {
      key: "time",
      header: "Time",
      render: (item: InspectionRecord) =>
        new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
    {
      key: "qaDecision",
      header: "QA Status",
      render: (item: InspectionRecord) => (
        <span className={`text-xs font-bold ${qaLabelClass(item.qaDecision, item.status)}`}>
          {qaLabel(item.qaDecision, item.status)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (item: InspectionRecord) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Eye size={14} />}
          onClick={() => setDetailModal({ open: true, inspection: item })}
        />
      ),
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
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white">
              <FileSearch size={22} />
            </div>
            Inspections
          </h1>
          <p className="text-gray-500 mt-1 ml-13">All inspection records and results.</p>
        </div>
        <div className="flex items-center gap-2">
          {(["ALL", "ACCEPTED", "REJECTED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterResult(f)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                filterResult === f
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              {f === "ALL" ? "All" : f === "ACCEPTED" ? "Accepted" : "Rejected"}
            </button>
          ))}
          <Button variant="ghost" size="sm" icon={<RotateCcw size={16} />} onClick={fetchInspections} />
          <button className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 ml-1">
            <Download size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Inspections" value={String(inspections.length)} icon={<FileSearch size={24} />} />
        <KPICard title="Accepted" value={String(acceptedCount)} icon={<CheckCircle2 size={24} />} variant="highlight" />
        <KPICard title="Rejected" value={String(rejectedCount)} icon={<XCircle size={24} />} />
        <KPICard title="Pending QA" value={String(pendingQACount)} icon={<Filter size={24} />} />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileSearch size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-400 font-bold">No inspection records found</p>
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, inspection: null })}
        title="Inspection Detail"
      >
        {detailModal.inspection && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Part Number</p>
                <p className="text-lg font-black">{detailModal.inspection.partNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Result</p>
                {detailModal.inspection.result ? (
                  <Badge variant={resultVariant[detailModal.inspection.result]}>
                    {detailModal.inspection.result}
                  </Badge>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Operator</p>
                <p className="font-medium">{detailModal.inspection.operatorName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Machine</p>
                <p className="font-medium">{detailModal.inspection.machine?.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Date</p>
                <p className="font-medium">{new Date(detailModal.inspection.updatedAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Time</p>
                <p className="font-medium">
                  {new Date(detailModal.inspection.updatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Operator Time</p>
                <p className="font-medium">
                  {detailModal.inspection.operatorActualTime != null
                    ? `${detailModal.inspection.operatorActualTime} min`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Inspection Time</p>
                <p className="font-medium">
                  {detailModal.inspection.inspectionActualTime != null
                    ? `${detailModal.inspection.inspectionActualTime} min`
                    : "—"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 font-bold uppercase">QA Decision</p>
                <p className={`font-bold text-sm ${qaLabelClass(detailModal.inspection.qaDecision, detailModal.inspection.status)}`}>
                  {qaLabel(detailModal.inspection.qaDecision, detailModal.inspection.status)}
                </p>
                {detailModal.inspection.qaReviewerName && (
                  <p className="text-xs text-gray-400 mt-1">by {detailModal.inspection.qaReviewerName}</p>
                )}
              </div>
              {detailModal.inspection.notes && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 font-bold uppercase">Notes</p>
                  <p className="font-medium text-sm">{detailModal.inspection.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
