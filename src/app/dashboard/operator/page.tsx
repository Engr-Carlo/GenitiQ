"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Card, Button, Badge, KPICard, ConfirmDialog,
  StatusIndicator, LoadingSpinner, Modal,
} from "@/components/ui";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { cn } from "@/lib/utils";
import {
  Cpu, LogOut, LogIn,
  Activity, Clock, CheckCircle2, XCircle, ListChecks,
  ScanBarcode, Play, Timer, Package, AlertTriangle,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface MachineData {
  id: string;
  name: string;
  type: "VMM" | "CMM";
  status: string;
  location?: string | null;
  queueLength?: number;
  hasActiveSession?: boolean;
  currentOperator?: { id: string; name: string } | null;
}

interface QueueItemData {
  id: string;
  partId: string;
  position: number;
  estimatedTime: number;
  priority: string;
  status: string;
  scannedAt?: string | null;
  scannedBarcode?: string | null;
  queueStartedAt?: string | null;
  part: {
    id: string;
    partNumber: string;
    name: string | null;
    barcodeData?: string | null;
  };
}

interface SessionData {
  id: string;
  machineId: string;
  startTime: string;
  status: string;
  itemsCompleted: number;
  machine: { id: string; name: string; type: string; status: string; location?: string | null };
  operator: { id: string; name: string; accountId: string };
}

// ============================================================
// Inspection Timer
// ============================================================

function InspectionTimer({ startedAt, estimatedMinutes }: { startedAt: Date | null; estimatedMinutes: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const estimatedSeconds = estimatedMinutes * 60;
  const ratio = estimatedSeconds > 0 ? elapsed / estimatedSeconds : 0;

  const color = ratio < 0.7 ? "text-success-600" : ratio < 1.0 ? "text-warning-600" : "text-danger-600";
  const bgColor = ratio < 0.7 ? "bg-success-100" : ratio < 1.0 ? "bg-warning-100" : "bg-danger-100";
  const barColor = ratio < 0.7 ? "bg-success-500" : ratio < 1.0 ? "bg-warning-500" : "bg-danger-500";

  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl", bgColor)}>
      <Timer size={24} className={color} />
      <div>
        <span className={cn("text-2xl font-black tabular-nums", color)}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
        <p className="text-xs text-gray-500">Est. {estimatedMinutes} min</p>
      </div>
      <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden ml-4">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(ratio * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Session Timer (header)
// ============================================================

function SessionTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(startTime).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span className="text-sm font-mono font-bold text-primary-700 bg-primary-50 px-3 py-1 rounded-full">
      <Clock size={14} className="inline mr-1" />
      {elapsed}
    </span>
  );
}

// ============================================================
// Machine Selection Screen
// ============================================================

function MachineSelection({
  machines,
  loading,
  onCheckIn,
}: {
  machines: MachineData[];
  loading: boolean;
  onCheckIn: (machine: MachineData) => void;
}) {
  const vmmMachines = machines.filter((m) => m.type === "VMM");
  const cmmMachines = machines.filter((m) => m.type === "CMM");

  const MachineGrid = ({ title, items }: { title: string; items: MachineData[] }) => (
    <div>
      <h3 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3 flex items-center gap-2">
        <Cpu size={20} className="text-primary-600" />
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((machine) => {
          const isUnavailable = machine.status === "SHUTDOWN" || machine.status === "MAINTENANCE";
          const isInUse = machine.hasActiveSession;

          return (
            <Card
              key={machine.id}
              className={cn(
                "relative overflow-hidden transition-all",
                isUnavailable && "opacity-50",
                !isUnavailable && !isInUse && "hover:border-primary-400 hover:shadow-md cursor-pointer"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge variant={machine.type === "VMM" ? "info" : "warning"} className="text-xs mb-1">
                    {machine.type}
                  </Badge>
                  <h4 className="text-lg font-black text-gray-900">{machine.name}</h4>
                  {machine.location && <p className="text-xs text-gray-500">{machine.location}</p>}
                </div>
                {isInUse ? (
                  <Badge variant="danger">In Use</Badge>
                ) : isUnavailable ? (
                  <Badge variant="gray">{machine.status}</Badge>
                ) : (
                  <Badge variant="success">Available</Badge>
                )}
              </div>

              {isInUse && machine.currentOperator && (
                <p className="text-xs text-gray-500 mb-3">
                  Used by: {machine.currentOperator.name}
                </p>
              )}

              <Button
                size="sm"
                variant="primary"
                icon={<LogIn size={14} />}
                onClick={() => onCheckIn(machine)}
                disabled={isUnavailable || !!isInUse}
                className="w-full"
              >
                {isInUse ? "In Use" : isUnavailable ? machine.status : "Check In"}
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black text-gray-900 uppercase tracking-wide">Select Your Machine</h1>
        <p className="text-gray-500 mt-1">Choose a machine to begin your session</p>
      </div>
      {vmmMachines.length > 0 && <MachineGrid title="VMM Machines" items={vmmMachines} />}
      {cmmMachines.length > 0 && <MachineGrid title="CMM Machines" items={cmmMachines} />}
      {machines.length === 0 && (
        <Card className="text-center py-12">
          <Cpu size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-500">No machines available</h3>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Active Session Screen
// ============================================================

function ActiveSessionView({
  sessionData,
  currentItem,
  nextQueueItem,
  waitingCount,
  itemsCompletedCount,
  onCheckOut,
  onRefresh,
}: {
  sessionData: SessionData;
  currentItem: QueueItemData | null;
  nextQueueItem: QueueItemData | null;
  waitingCount: number;
  itemsCompletedCount: number;
  onCheckOut: () => void;
  onRefresh: () => void;
}) {
  const [scanMode, setScanMode] = useState<"idle" | "scanning" | "scanned">("idle");
  const [workingItem, setWorkingItem] = useState<QueueItemData | null>(currentItem);
  const [inspectionStartedAt, setInspectionStartedAt] = useState<Date | null>(
    currentItem?.queueStartedAt ? new Date(currentItem.queueStartedAt) : null
  );
  const [resultModal, setResultModal] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<"ACCEPTED" | "REJECTED" | null>(null);
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [checkoutConfirm, setCheckoutConfirm] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<Record<string, any> | null>(null);
  const [reportModal, setReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportShutdown, setReportShutdown] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // The item to display: current in-progress item or next waiting
  const displayItem = workingItem || nextQueueItem;

  // Sync props when they change
  useEffect(() => {
    if (currentItem) {
      setWorkingItem(currentItem);
      if (currentItem.queueStartedAt) setInspectionStartedAt(new Date(currentItem.queueStartedAt));
      if (currentItem.scannedAt) setScanMode("scanned");
    }
  }, [currentItem]);

  // Barcode scanner hook
  const { scannedCode, reset: resetScanner } = useBarcodeScanner({
    enabled: scanMode === "scanning",
    onScan: async (barcode) => {
      if (!displayItem) return;
      await handleBarcodeScan(barcode);
    },
  });

  const handleBarcodeScan = async (barcode: string) => {
    if (!displayItem) return;
    setScanError(null);

    try {
      const res = await fetch(`/api/queue/${displayItem.id}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });

      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || "Scan failed");
        return;
      }

      if (!data.data?.verified) {
        setScanError(data.message || "Barcode mismatch");
        return;
      }

      setScanMode("scanned");
      setWorkingItem((prev) => {
        const base = prev || displayItem;
        return base ? { ...base, scannedAt: new Date().toISOString(), scannedBarcode: barcode } : null;
      });
    } catch {
      setScanError("Failed to verify barcode");
    }
  };

  const handleStartInspection = async () => {
    if (!displayItem) return;

    try {
      const res = await fetch(`/api/queue/${displayItem.id}/start`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        setScanError(data.error || "Failed to start");
        return;
      }

      const now = new Date();
      setInspectionStartedAt(now);
      setWorkingItem({ ...displayItem, status: "IN_PROGRESS", queueStartedAt: now.toISOString() });
    } catch {
      setScanError("Failed to start inspection");
    }
  };

  const handleCompleteInspection = async () => {
    if (!workingItem || !inspectionResult) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/queue/${workingItem.id}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result: inspectionResult,
          notes: inspectionNotes || null,
        }),
      });

      if (res.ok) {
        // Reset state for next item
        setWorkingItem(null);
        setInspectionStartedAt(null);
        setScanMode("idle");
        setResultModal(false);
        setInspectionResult(null);
        setInspectionNotes("");
        resetScanner();
        onRefresh();
      }
    } catch (error) {
      console.error("Failed to complete inspection:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      const res = await fetch(`/api/machines/${sessionData.machineId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (res.ok) {
        setSessionSummary(data.data?.summary || null);
      } else {
        onCheckOut();
      }
    } catch (error) {
      console.error("Failed to check out:", error);
      onCheckOut();
    }
  };

  const handleReportIssue = async () => {
    if (!reportReason.trim()) return;
    
    setReportSubmitting(true);
    try {
      const res = await fetch(`/api/machines/${sessionData.machineId}/report`, {
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
          // Machine was shut down, force checkout
          onCheckOut();
        } else {
          // Just reported an issue, continue working
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

  const isWorking = workingItem?.status === "IN_PROGRESS";

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <Card className="bg-gradient-to-r from-primary-50 to-primary-100/50 border-primary-200">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary-800 text-white flex items-center justify-center">
              <Cpu size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">{sessionData.machine.name}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Badge variant={sessionData.machine.type === "VMM" ? "info" : "warning"}>{sessionData.machine.type}</Badge>
                <StatusIndicator status={sessionData.machine.status} size="sm" />
                {sessionData.machine.location && <span>• {sessionData.machine.location}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SessionTimer startTime={sessionData.startTime} />
            <Button
              variant="warning"
              size="sm"
              icon={<AlertTriangle size={14} />}
              onClick={() => setReportModal(true)}
              disabled={isWorking}
            >
              Report Issue
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<LogOut size={14} />}
              onClick={() => setCheckoutConfirm(true)}
              disabled={isWorking}
            >
              Check Out
            </Button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Items Completed" value={String(itemsCompletedCount)} icon={<CheckCircle2 size={28} />} variant="highlight" />
        <KPICard title="Waiting in Queue" value={String(waitingCount)} icon={<ListChecks size={28} />} />
        <KPICard title="Machine Type" value={sessionData.machine.type} icon={<Cpu size={28} />} />
        <KPICard title="Session Status" value={sessionData.status} icon={<Activity size={28} />} />
      </div>

      {/* Current Work Area */}
      {displayItem ? (
        <Card className="border-2 border-primary-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black uppercase tracking-wide text-gray-900 flex items-center gap-2">
              <Package size={20} className="text-primary-600" />
              {isWorking ? "Current Inspection" : "Next Item"}
            </h3>
            <Badge variant={isWorking ? "info" : displayItem.scannedAt ? "success" : "warning"}>
              {isWorking ? "In Progress" : displayItem.scannedAt ? "Scanned — Ready" : "Waiting to Scan"}
            </Badge>
          </div>

          {/* Part Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">Part Number</p>
              <p className="text-lg font-black text-gray-900">{displayItem.part.partNumber}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">Part Name</p>
              <p className="text-sm font-medium text-gray-700">{displayItem.part.name || "-"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">Priority</p>
              <Badge variant={displayItem.priority === "HIGH" ? "danger" : displayItem.priority === "MEDIUM" ? "warning" : "info"}>
                {displayItem.priority}
              </Badge>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">Est. Time</p>
              <p className="text-sm font-bold text-gray-700">{displayItem.estimatedTime} min</p>
            </div>
          </div>

          {/* Timer (visible when inspection is active) */}
          {isWorking && inspectionStartedAt && (
            <div className="mb-4">
              <InspectionTimer startedAt={inspectionStartedAt} estimatedMinutes={displayItem.estimatedTime} />
            </div>
          )}

          {/* Workflow Steps */}
          <div className="space-y-3">
            {/* Step 1: Scan */}
            {!displayItem.scannedAt && !isWorking && (
              <div className="space-y-3">
                {scanMode === "idle" && (
                  <Button
                    variant="primary"
                    icon={<ScanBarcode size={18} />}
                    onClick={() => setScanMode("scanning")}
                    className="w-full py-4 text-lg"
                  >
                    Scan Barcode
                  </Button>
                )}

                {scanMode === "scanning" && (
                  <div className="bg-primary-50 border-2 border-primary-300 border-dashed rounded-xl p-6 text-center">
                    <ScanBarcode size={48} className="mx-auto text-primary-500 animate-pulse mb-3" />
                    <p className="text-lg font-bold text-primary-800">Scan the part barcode now...</p>
                    <p className="text-sm text-gray-500 mt-1">Using USB barcode scanner</p>

                    {/* Manual entry fallback */}
                    <div className="mt-4 flex items-center gap-2 max-w-md mx-auto">
                      <input
                        ref={manualInputRef}
                        type="text"
                        className="barcode-scanner-input input-field flex-1 text-center font-mono"
                        placeholder="Or type barcode manually..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && manualInputRef.current?.value) {
                            handleBarcodeScan(manualInputRef.current.value);
                            manualInputRef.current.value = "";
                          }
                        }}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => { setScanMode("idle"); setScanError(null); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {scanError && (
                  <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 flex items-center gap-2 text-danger-700">
                    <AlertTriangle size={16} />
                    <span className="text-sm font-medium">{scanError}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setScanError(null); setScanMode("scanning"); }}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Start Inspection (after scan) */}
            {(displayItem.scannedAt || scanMode === "scanned") && !isWorking && (
              <div className="space-y-3">
                <div className="bg-success-50 border border-success-200 rounded-lg p-3 flex items-center gap-2 text-success-700">
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-medium">
                    Barcode verified: {displayItem.scannedBarcode || scannedCode}
                  </span>
                </div>
                <Button
                  variant="success"
                  icon={<Play size={18} />}
                  onClick={handleStartInspection}
                  className="w-full py-4 text-lg"
                >
                  Start Inspection
                </Button>
              </div>
            )}

            {/* Step 3: Complete Inspection (while working) */}
            {isWorking && (
              <div className="flex gap-3">
                <Button
                  variant="success"
                  icon={<CheckCircle2 size={18} />}
                  onClick={() => { setInspectionResult("ACCEPTED"); setResultModal(true); }}
                  className="flex-1 py-4 text-lg"
                >
                  Accept
                </Button>
                <Button
                  variant="danger"
                  icon={<XCircle size={18} />}
                  onClick={() => { setInspectionResult("REJECTED"); setResultModal(true); }}
                  className="flex-1 py-4 text-lg"
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card className="text-center py-12">
          <ListChecks size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-500">No items in queue</h3>
          <p className="text-sm text-gray-400 mt-1">Waiting for items to be assigned to {sessionData.machine.name}</p>
          <Button variant="secondary" size="sm" onClick={onRefresh} className="mt-4">
            Refresh Queue
          </Button>
        </Card>
      )}

      {/* Inspection Result Modal */}
      <Modal
        isOpen={resultModal}
        onClose={() => { setResultModal(false); setInspectionResult(null); }}
        title={`Submit Result: ${inspectionResult}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {inspectionResult === "ACCEPTED" ? (
              <CheckCircle2 size={40} className="text-success-500" />
            ) : (
              <XCircle size={40} className="text-danger-500" />
            )}
            <div>
              <p className="font-bold text-lg">{workingItem?.part.partNumber}</p>
              <p className="text-sm text-gray-500">
                Result: <span className={inspectionResult === "ACCEPTED" ? "text-success-600 font-bold" : "text-danger-600 font-bold"}>{inspectionResult}</span>
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Notes</label>
            <textarea
              className="input-field min-h-[80px] resize-none"
              placeholder={inspectionResult === "REJECTED" ? "Reason for rejection (required)..." : "Additional notes (optional)..."}
              value={inspectionNotes}
              onChange={(e) => setInspectionNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setResultModal(false); setInspectionResult(null); }}>Cancel</Button>
            <Button
              variant={inspectionResult === "ACCEPTED" ? "success" : "danger"}
              onClick={handleCompleteInspection}
              loading={submitting}
              disabled={inspectionResult === "REJECTED" && !inspectionNotes.trim()}
            >
              Confirm {inspectionResult}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Checkout Confirmation */}
      <ConfirmDialog
        isOpen={checkoutConfirm}
        onClose={() => setCheckoutConfirm(false)}
        onConfirm={handleCheckOut}
        title="Check Out"
        message={`End your session on ${sessionData.machine.name}? You completed ${itemsCompletedCount} items.`}
        confirmText="Check Out"
        variant="danger"
      />

      {/* Session Summary Modal */}
      <Modal
        isOpen={!!sessionSummary}
        onClose={() => { setSessionSummary(null); onCheckOut(); }}
        title="Session Summary"
        size="md"
      >
        {sessionSummary && (
          <div className="space-y-4 text-center">
            <CheckCircle2 size={48} className="mx-auto text-success-500" />
            <h3 className="text-xl font-black text-gray-900">Session Complete</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-2xl font-black text-primary-800">{sessionSummary.duration} min</p>
                <p className="text-xs text-gray-500 uppercase font-bold">Duration</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-2xl font-black text-primary-800">{sessionSummary.itemsCompleted}</p>
                <p className="text-xs text-gray-500 uppercase font-bold">Items</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-2xl font-black text-primary-800">{sessionSummary.machineName}</p>
                <p className="text-xs text-gray-500 uppercase font-bold">Machine</p>
              </div>
            </div>
            <Button variant="primary" onClick={() => { setSessionSummary(null); onCheckOut(); }} className="w-full">
              Done
            </Button>
          </div>
        )}
      </Modal>

      {/* Report Issue Modal */}
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
              <p className="font-bold">Report an issue with {sessionData.machine.name}</p>
              <p className="text-xs text-gray-500">If you request shutdown, your session will end and the machine will be unavailable.</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Issue Description *</label>
            <textarea
              className="input-field min-h-[100px] resize-none"
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
              variant={reportShutdown ? "danger" : "warning"}
              onClick={handleReportIssue}
              loading={reportSubmitting}
              disabled={!reportReason.trim()}
            >
              {reportShutdown ? "Shutdown & Report" : "Report Issue"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// Main Operator Dashboard
// ============================================================

export default function OperatorDashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<MachineData[]>([]);
  const [activeSession, setActiveSession] = useState<SessionData | null>(null);
  const [currentItem, setCurrentItem] = useState<QueueItemData | null>(null);
  const [nextQueueItem, setNextQueueItem] = useState<QueueItemData | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);
  const [itemsCompletedCount, setItemsCompletedCount] = useState(0);
  const [checkingIn, setCheckingIn] = useState(false);

  if (session?.user?.role !== "OPERATOR") {
    redirect("/dashboard");
  }

  const fetchSessionState = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/session");
      const data = await res.json();

      if (data.data?.session) {
        setActiveSession(data.data.session);
        setCurrentItem(data.data.currentItem);
        setNextQueueItem(data.data.nextQueueItem);
        setWaitingCount(data.data.waitingCount);
        setItemsCompletedCount(data.data.itemsCompletedCount);
      } else {
        setActiveSession(null);
        setCurrentItem(null);
        setNextQueueItem(null);
        setWaitingCount(0);
        setItemsCompletedCount(0);
      }
    } catch (error) {
      console.error("Error fetching session:", error);
    }
  }, []);

  const fetchMachines = useCallback(async () => {
    try {
      const res = await fetch("/api/machines");
      const data = await res.json();
      setMachines(data.data || []);
    } catch (error) {
      console.error("Error fetching machines:", error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchSessionState(), fetchMachines()]);
      setLoading(false);
    };
    init();
  }, [fetchSessionState, fetchMachines]);

  // Auto-refresh session data every 30 seconds
  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(fetchSessionState, 30000);
    return () => clearInterval(interval);
  }, [activeSession, fetchSessionState]);

  const handleCheckIn = async (machine: MachineData) => {
    setCheckingIn(true);
    try {
      const res = await fetch(`/api/machines/${machine.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        await fetchSessionState();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to check in");
      }
    } catch (error) {
      console.error("Failed to check in:", error);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSessionEnd = () => {
    setActiveSession(null);
    fetchMachines();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // If operator has active session → show work UI
  if (activeSession) {
    return (
      <ActiveSessionView
        sessionData={activeSession}
        currentItem={currentItem}
        nextQueueItem={nextQueueItem}
        waitingCount={waitingCount}
        itemsCompletedCount={itemsCompletedCount}
        onCheckOut={handleSessionEnd}
        onRefresh={fetchSessionState}
      />
    );
  }

  // Otherwise → show machine selection
  return (
    <MachineSelection
      machines={machines}
      loading={checkingIn}
      onCheckIn={handleCheckIn}
    />
  );
}
