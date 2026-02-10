"use client";

import React, { useState } from "react";
import { Badge, Button, DataTable, Modal, KPICard } from "@/components/ui";
import {
  FileSearch, CheckCircle2, XCircle, Filter, Download, Eye,
} from "lucide-react";

const mockInspections = [
  { id: "1", partNumber: "PN1001", inspector: "J. Dela Cruz", machine: "VMM-1", result: "ACCEPTED" as const, date: "Jan 23, 2026", time: "09:15 AM", qaStatus: "N/A" },
  { id: "2", partNumber: "PN1003", inspector: "A. Santos", machine: "VMM-2", result: "REJECTED" as const, date: "Jan 23, 2026", time: "10:30 AM", qaStatus: "Pending" },
  { id: "3", partNumber: "PN1005", inspector: "J. Dela Cruz", machine: "CMM-1", result: "ACCEPTED" as const, date: "Jan 23, 2026", time: "11:00 AM", qaStatus: "N/A" },
  { id: "4", partNumber: "PN1007", inspector: "A. Santos", machine: "CMM-2", result: "REJECTED" as const, date: "Jan 22, 2026", time: "02:45 PM", qaStatus: "Override" },
  { id: "5", partNumber: "PN1010", inspector: "J. Dela Cruz", machine: "VMM-5", result: "ACCEPTED" as const, date: "Jan 22, 2026", time: "04:20 PM", qaStatus: "N/A" },
  { id: "6", partNumber: "PN1012", inspector: "J. Dela Cruz", machine: "VMM-6", result: "ACCEPTED" as const, date: "Jan 21, 2026", time: "08:00 AM", qaStatus: "N/A" },
  { id: "7", partNumber: "PN1015", inspector: "V. De Jose", machine: "VMM-3", result: "REJECTED" as const, date: "Jan 21, 2026", time: "10:10 AM", qaStatus: "Re-inspect" },
  { id: "8", partNumber: "PN1018", inspector: "A. Santos", machine: "CMM-1", result: "ACCEPTED" as const, date: "Jan 20, 2026", time: "01:30 PM", qaStatus: "N/A" },
];

const resultVariant: Record<string, "success" | "danger"> = {
  ACCEPTED: "success",
  REJECTED: "danger",
};

export default function InspectionsPage() {
  const [filterResult, setFilterResult] = useState<"ALL" | "ACCEPTED" | "REJECTED">("ALL");
  const [detailModal, setDetailModal] = useState<{ open: boolean; inspection: (typeof mockInspections)[0] | null }>({
    open: false,
    inspection: null,
  });

  const filtered = filterResult === "ALL" ? mockInspections : mockInspections.filter((i) => i.result === filterResult);

  const columns = [
    { key: "partNumber", header: "Part No.", className: "font-bold" },
    { key: "inspector", header: "Inspector" },
    { key: "machine", header: "Machine" },
    {
      key: "result",
      header: "Result",
      render: (item: (typeof mockInspections)[0]) => (
        <Badge variant={resultVariant[item.result]}>
          {item.result === "ACCEPTED" && <CheckCircle2 size={12} className="inline mr-1" />}
          {item.result === "REJECTED" && <XCircle size={12} className="inline mr-1" />}
          {item.result}
        </Badge>
      ),
    },
    { key: "date", header: "Date" },
    { key: "time", header: "Time" },
    {
      key: "qaStatus",
      header: "QA Status",
      render: (item: (typeof mockInspections)[0]) => (
        <span
          className={`text-xs font-bold ${
            item.qaStatus === "Pending"
              ? "text-warning-600"
              : item.qaStatus === "Override"
              ? "text-primary-600"
              : item.qaStatus === "Re-inspect"
              ? "text-danger-600"
              : "text-gray-400"
          }`}
        >
          {item.qaStatus}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (item: (typeof mockInspections)[0]) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Eye size={14} />}
          onClick={() => setDetailModal({ open: true, inspection: item })}
        />
      ),
    },
  ];

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
          <button className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 ml-2">
            <Download size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Inspections" value={String(mockInspections.length)} icon={<FileSearch size={24} />} />
        <KPICard
          title="Accepted"
          value={String(mockInspections.filter((i) => i.result === "ACCEPTED").length)}
          icon={<CheckCircle2 size={24} />}
          variant="highlight"
        />
        <KPICard
          title="Rejected"
          value={String(mockInspections.filter((i) => i.result === "REJECTED").length)}
          icon={<XCircle size={24} />}
        />
        <KPICard
          title="Pending QA"
          value={String(mockInspections.filter((i) => i.qaStatus === "Pending").length)}
          icon={<Filter size={24} />}
        />
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filtered} />

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
                <Badge variant={resultVariant[detailModal.inspection.result]}>{detailModal.inspection.result}</Badge>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Inspector</p>
                <p className="font-medium">{detailModal.inspection.inspector}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Machine</p>
                <p className="font-medium">{detailModal.inspection.machine}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Date</p>
                <p className="font-medium">{detailModal.inspection.date}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold uppercase">Time</p>
                <p className="font-medium">{detailModal.inspection.time}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 font-bold uppercase">QA Status</p>
                <p className="font-medium">{detailModal.inspection.qaStatus}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
