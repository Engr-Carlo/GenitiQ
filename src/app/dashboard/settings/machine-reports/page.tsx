"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Badge, Button, Modal, LoadingSpinner, KPICard } from "@/components/ui";
import { useSession } from "next-auth/react";
import {
  AlertTriangle, CheckCircle2, Clock, Monitor, Bell, Send,
  XCircle, RotateCcw, Filter,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface MachineReport {
  id: string;
  machineId: string;
  machine: { id: string; name: string; type: string; status: string };
  reportedById: string;
  reportedBy: { id: string; name: string; email: string };
  reason: string;
  status: string;
  createdAt: string;
}

interface MachineOption {
  value: string;
  label: string;
}

const statusConfig: Record<string, { color: string; bg: string; border: string; badge: "warning" | "success" | "danger" | "info" }> = {
  Pending: { color: "text-warning-700", bg: "bg-warning-50", border: "border-l-warning-500", badge: "warning" },
  Resolved: { color: "text-success-700", bg: "bg-success-50", border: "border-l-success-500", badge: "success" },
  Shutdown: { color: "text-danger-700", bg: "bg-danger-50", border: "border-l-danger-500", badge: "danger" },
};

const statusIcon: Record<string, React.ReactNode> = {
  Pending: <Clock size={18} className="text-warning-500" />,
  Resolved: <CheckCircle2 size={18} className="text-success-500" />,
  Shutdown: <XCircle size={18} className="text-danger-500" />,
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ============================================================
// Machine Reports Page
// ============================================================

export default function MachineReportsPage() {
  const { data: session } = useSession();
  const [reports, setReports] = useState<MachineReport[]>([]);
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"ALL" | "Pending" | "Resolved" | "Shutdown">("ALL");
  const [submitModal, setSubmitModal] = useState(false);
  const [submitMachine, setSubmitMachine] = useState("");
  const [submitReason, setSubmitReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "INSPECTOR";

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsRes, machinesRes] = await Promise.all([
        fetch("/api/machine-reports"),
        fetch("/api/machines"),
      ]);
      const reportsData = await reportsRes.json();
      const machinesData = await machinesRes.json();
      setReports(reportsData.data || []);
      const opts = (machinesData.data || []).map((m: any) => ({ value: m.id, label: m.name }));
      setMachines(opts);
      if (opts.length > 0 && !submitMachine) setSubmitMachine(opts[0].value);
    } catch (e) {
      console.error("Error fetching data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmitReport = async () => {
    if (!submitMachine || !submitReason.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/machine-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId: submitMachine, reason: submitReason.trim() }),
      });
      setSubmitModal(false);
      setSubmitReason("");
      fetchData();
    } catch (e) {
      console.error("Failed to submit report:", e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (reportId: string, newStatus: string) => {
    setResolving(reportId);
    try {
      await fetch("/api/machine-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reportId, status: newStatus }),
      });
      fetchData();
    } catch (e) {
      console.error("Failed to update report:", e);
    } finally {
      setResolving(null);
    }
  };

  const filtered = filterStatus === "ALL" ? reports : reports.filter(r => r.status === filterStatus);
  const pendingCount = reports.filter(r => r.status === "Pending").length;
  const resolvedCount = reports.filter(r => r.status === "Resolved").length;
  const shutdownCount = reports.filter(r => r.status === "Shutdown").length;

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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-warning-500 to-danger-500 flex items-center justify-center text-white">
              <Bell size={22} />
            </div>
            Machine Reports
          </h1>
          <p className="text-gray-500 mt-1 ml-13">
            Machine issues, status reports, and notifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={<Send size={16} />}
            onClick={() => setSubmitModal(true)}
          >
            New Report
          </Button>
          <Button variant="ghost" size="sm" icon={<RotateCcw size={16} />} onClick={fetchData} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Reports" value={String(reports.length)} icon={<Monitor size={24} />} />
        <KPICard title="Pending" value={String(pendingCount)} icon={<Clock size={24} />} variant={pendingCount > 0 ? "highlight" : "default"} />
        <KPICard title="Resolved" value={String(resolvedCount)} icon={<CheckCircle2 size={24} />} />
        <KPICard title="Shutdown" value={String(shutdownCount)} icon={<XCircle size={24} />} />
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-gray-400" />
        {(["ALL", "Pending", "Resolved", "Shutdown"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              filterStatus === f
                ? "bg-primary-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            {f === "ALL" ? `All (${reports.length})` : `${f} (${reports.filter(r => r.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Notification Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-bold text-lg">No reports found</p>
          <p className="text-gray-400 text-sm mt-1">
            {filterStatus === "ALL"
              ? "No machine reports have been submitted yet."
              : `No ${filterStatus.toLowerCase()} reports.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => {
            const cfg = statusConfig[report.status] || statusConfig.Pending;
            return (
              <div
                key={report.id}
                className={`${cfg.bg} border-l-4 ${cfg.border} rounded-lg p-4 shadow-sm transition-all hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Main content */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5">
                      {statusIcon[report.status] || statusIcon.Pending}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-black text-gray-900">{report.machine.name}</span>
                        <Badge variant={report.machine.type === "VMM" ? "info" : "warning"}>
                          {report.machine.type}
                        </Badge>
                        <Badge variant={cfg.badge}>{report.status}</Badge>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{report.reason}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Reported by <strong>{report.reportedBy.name}</strong></span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {timeAgo(report.createdAt)}
                        </span>
                        <span>{new Date(report.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions — only for admins/inspectors on pending reports */}
                  {isAdmin && report.status === "Pending" && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="success"
                        size="sm"
                        icon={<CheckCircle2 size={14} />}
                        onClick={() => handleResolve(report.id, "Resolved")}
                        loading={resolving === report.id}
                      >
                        Resolve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<AlertTriangle size={14} />}
                        onClick={() => handleResolve(report.id, "Shutdown")}
                        loading={resolving === report.id}
                      >
                        Shutdown
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Report Modal */}
      <Modal
        isOpen={submitModal}
        onClose={() => setSubmitModal(false)}
        title="Submit Machine Report"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Machine</label>
            <select
              className="input-field"
              value={submitMachine}
              onChange={(e) => setSubmitMachine(e.target.value)}
            >
              {machines.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Issue Description</label>
            <textarea
              className="input-field min-h-[100px] resize-none"
              placeholder="Describe the issue with the machine..."
              value={submitReason}
              onChange={(e) => setSubmitReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setSubmitModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={<Send size={16} />}
              onClick={handleSubmitReport}
              loading={submitting}
              disabled={!submitMachine || !submitReason.trim()}
            >
              Submit Report
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
