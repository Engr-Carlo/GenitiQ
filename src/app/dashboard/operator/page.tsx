"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Card, Button, Badge, Input,
} from "@/components/ui";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import {
  ScanBarcode, Package, Clock, Calendar, Hash, Cpu, CheckCircle2, History, Check, X,
  AlertTriangle, TrendingUp,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface SuccessData {
  partNumber: string;
  barcode: string;
  result: "ACCEPTED" | "REJECTED";
  timeIn: string;
  timeOut: string;
  duration: string;
  machineName?: string;
  inspectorName?: string;
}

interface BarcodeReference {
  id: string;
  partNumber: string;
  barcode: string;
  estimatedTime: number;
  deadline: string;
  quantity: number;
  status: string;
  machine?: {
    id: string;
    name: string;
    type: string;
    status: string;
  } | null;
  inspector?: {
    id: string;
    name: string;
    email: string;
  } | null;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

interface ScannedHistory {
  barcode: string;
  partNumber: string;
  scannedAt: string;
  machineName?: string;
}

// ============================================================
// Operator Dashboard - Barcode Scanner Only
// ============================================================

export default function OperatorDashboardPage() {
  const { data: session } = useSession();
  const [scanMode, setScanMode] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannedReference, setScannedReference] = useState<BarcodeReference | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [scannedHistory, setScannedHistory] = useState<ScannedHistory[]>([]);
  const [timeIn, setTimeIn] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW" | null>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  // GA-based priority calculation
  const calculatePriority = (ref: BarcodeReference): "HIGH" | "MEDIUM" | "LOW" => {
    const hoursToDeadline = (new Date(ref.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
    const urgencyScore = Math.max(0, 100 - hoursToDeadline / 2);
    const complexityScore = (ref.estimatedTime / 60) * 50 + (ref.quantity / 10) * 50;
    const fitness = urgencyScore * 0.6 + complexityScore * 0.4;
    if (fitness > 70 || hoursToDeadline < 24) return "HIGH";
    if (fitness > 40 || hoursToDeadline < 72) return "MEDIUM";
    return "LOW";
  };

  if (session?.user?.role !== "OPERATOR") {
    redirect("/dashboard");
  }

  // Auto-focus manual input when scan mode is enabled
  useEffect(() => {
    if (scanMode && manualInputRef.current) {
      manualInputRef.current.focus();
    }
  }, [scanMode]);

  // Load scanned history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("operator_scan_history");
    if (saved) {
      try {
        setScannedHistory(JSON.parse(saved));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Barcode scanner hook for hardware scanners
  const { scannedCode, reset: resetScanner } = useBarcodeScanner({
    enabled: scanMode,
    onScan: async (barcode) => {
      await handleBarcodeLookup(barcode);
    },
  });

  const handleBarcodeLookup = async (barcode: string) => {
    if (!barcode.trim()) {
      setError("Please enter a barcode");
      return;
    }

    setLoading(true);
    setError(null);
    setScannedReference(null);

    try {
      // Look up barcode in PartReference table
      const res = await fetch(`/api/admin/barcode-reference?barcode=${encodeURIComponent(barcode)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Barcode not found");
        return;
      }

      if (!data.data || data.data.length === 0) {
        setError("Barcode not found in system. Please contact admin.");
        return;
      }

      const reference = data.data[0];

      // Re-scan prevention: only allow PENDING or RE_INSPECT parts
      if (reference.status !== "PENDING" && reference.status !== "RE_INSPECT") {
        setError(`This part (${reference.partNumber}) is already scanned with status: ${reference.status}. Contact inspector if re-work is needed.`);
        return;
      }

      setScannedReference(reference);
      setPriority(calculatePriority(reference));
      setTimeIn(new Date().toISOString()); // Record time in when barcode is scanned

      // Save to history
      const historyItem: ScannedHistory = {
        barcode: reference.barcode,
        partNumber: reference.partNumber,
        scannedAt: new Date().toISOString(),
        machineName: reference.machine?.name,
      };
      const newHistory = [historyItem, ...scannedHistory].slice(0, 10);
      setScannedHistory(newHistory);
      localStorage.setItem("operator_scan_history", JSON.stringify(newHistory));
    } catch (error) {
      console.error("Barcode lookup error:", error);
      setError("Failed to look up barcode. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      handleBarcodeLookup(manualBarcode.trim());
      setManualBarcode("");
    }
  };

  const handleClearScan = () => {
    setScannedReference(null);
    setSuccessData(null);
    setError(null);
    setManualBarcode("");
    setTimeIn(null);
    setNotes("");
    setPriority(null);
    resetScanner();
  };

  const handleSubmitInspection = async (result: "ACCEPTED" | "REJECTED") => {
    if (!scannedReference || !timeIn) {
      setError("Missing scan data");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/operator/submit-inspection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeReferenceId: scannedReference.id,
          result,
          timeIn,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit inspection");
        return;
      }

      // Show inline success card instead of alert
      setSuccessData({ ...data.data, result });
      setScannedReference(null);
      setTimeIn(null);
      setNotes("");
      setPriority(null);
    } catch (error) {
      console.error("Submit inspection error:", error);
      setError("Failed to submit inspection. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white">
              <ScanBarcode size={28} />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-wide text-gray-900">
              Barcode Scanner
            </h1>
          </div>
          <p className="text-gray-500 text-lg">
            Scan or enter barcode to view part details
          </p>
        </div>

        {/* Scan Area */}
        {successData ? (
          /* ── Success Card ── */
          <Card className={`border-2 ${successData.result === "ACCEPTED" ? "border-success-300 bg-success-50/40" : "border-danger-300 bg-danger-50/40"}`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-white ${successData.result === "ACCEPTED" ? "bg-success-500" : "bg-danger-500"}`}>
                  {successData.result === "ACCEPTED" ? <Check size={28} /> : <X size={28} />}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900">
                    {successData.result === "ACCEPTED" ? "Part Accepted" : "Part Rejected"}
                  </h2>
                  <p className="text-sm text-gray-500">Sent to inspector for QA review</p>
                </div>
              </div>
              <Badge variant={successData.result === "ACCEPTED" ? "success" : "danger"} className="text-base px-4 py-1">
                {successData.result}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Package size={12} /> Part Number</p>
                <p className="font-black text-gray-900">{successData.partNumber}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><ScanBarcode size={12} /> Barcode</p>
                <p className="font-mono font-bold text-gray-900">{successData.barcode}</p>
              </div>
              {successData.machineName && (
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Cpu size={12} /> Machine</p>
                  <p className="font-bold text-gray-900">{successData.machineName}</p>
                </div>
              )}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock size={12} /> Time In</p>
                <p className="font-bold text-gray-900">{successData.timeIn ? new Date(successData.timeIn).toLocaleTimeString() : "-"}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock size={12} /> Time Out</p>
                <p className="font-bold text-gray-900">{successData.timeOut ? new Date(successData.timeOut).toLocaleTimeString() : "-"}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingUp size={12} /> Duration</p>
                <p className="font-black text-gray-900">{successData.duration}</p>
              </div>
              {successData.inspectorName && (
                <div className="bg-white p-4 rounded-lg border border-gray-200 col-span-2 md:col-span-3">
                  <p className="text-xs text-gray-500 mb-1">Assigned Inspector</p>
                  <p className="font-bold text-gray-900">{successData.inspectorName}</p>
                </div>
              )}
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full font-black uppercase"
              icon={<ScanBarcode size={20} />}
              onClick={handleClearScan}
            >
              Scan Next Part
            </Button>
          </Card>
        ) : !scannedReference ? (
          <Card className="p-8 text-center border-2 border-dashed border-gray-300">
            <div className="max-w-md mx-auto space-y-6">
              <div className="h-32 w-32 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center mx-auto">
                <ScanBarcode size={64} className="text-primary-600" />
              </div>

              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Ready to Scan</h2>
                <p className="text-gray-500">
                  Use a barcode scanner or enter manually below
                </p>
              </div>

              {/* Manual Input */}
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <Input
                  ref={manualInputRef}
                  placeholder="Enter barcode manually..."
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onFocus={() => setScanMode(true)}
                  onBlur={() => setTimeout(() => setScanMode(false), 100)}
                  icon={<ScanBarcode size={18} />}
                  className="text-center text-lg font-mono"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full font-black uppercase"
                  loading={loading}
                  disabled={loading || !manualBarcode.trim()}
                >
                  Lookup Barcode
                </Button>
              </form>

              {/* Error Message */}
              {error && (
                <div className="p-4 rounded-lg bg-danger-50 border border-danger-200 text-danger-900">
                  <p className="font-bold">{error}</p>
                </div>
              )}

              {/* Scanned Code Display */}
              {scannedCode && (
                <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <p className="text-sm text-gray-600">Last scanned:</p>
                  <p className="font-mono font-bold text-primary-700">{scannedCode}</p>
                </div>
              )}
            </div>
          </Card>
        ) : (
          // Barcode Details Display with Accept/Reject
          <Card className="border-2 border-success-200 bg-success-50/30">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-success-500 text-white flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">Barcode Verified</h2>
                  <p className="text-sm text-gray-500">
                    Time In: {timeIn ? new Date(timeIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {priority && (
                  <Badge
                    variant={priority === "HIGH" ? "danger" : priority === "MEDIUM" ? "warning" : "info"}
                    className="text-sm px-3 py-1"
                  >
                    <TrendingUp size={14} className="inline mr-1" />
                    {priority} PRIORITY
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={handleClearScan} disabled={submitting}>
                  Cancel
                </Button>
              </div>
            </div>

            {/* Part Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <Package size={14} />
                  <span>Part Number</span>
                </div>
                <p className="text-xl font-black text-gray-900">{scannedReference.partNumber}</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <ScanBarcode size={14} />
                  <span>Barcode</span>
                </div>
                <p className="text-lg font-mono font-bold text-gray-900">{scannedReference.barcode}</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <Clock size={14} />
                  <span>Estimated Time</span>
                </div>
                <p className="text-xl font-black text-gray-900">{scannedReference.estimatedTime} min</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <Calendar size={14} />
                  <span>Deadline</span>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {new Date(scannedReference.deadline).toLocaleDateString()}
                </p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <Hash size={14} />
                  <span>Quantity</span>
                </div>
                <p className="text-xl font-black text-gray-900">{scannedReference.quantity}</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <Cpu size={14} />
                  <span>Machine</span>
                </div>
                {scannedReference.machine ? (
                  <div>
                    <p className="text-lg font-black text-gray-900">{scannedReference.machine.name}</p>
                    <Badge variant={scannedReference.machine.type === "VMM" ? "info" : "warning"} className="mt-1">
                      {scannedReference.machine.type}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-gray-400 italic">Not assigned</p>
                )}
              </div>
            </div>

            {/* Inspector Info */}
            {scannedReference.inspector && (
              <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
                <p className="text-sm text-gray-500 mb-1">Assigned Inspector</p>
                <p className="font-bold text-gray-900">{scannedReference.inspector.name}</p>
                <p className="text-sm text-gray-500">{scannedReference.inspector.email}</p>
              </div>
            )}

            {/* Notes (Optional) */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                rows={3}
                placeholder="Add any observations or notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Accept/Reject Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="danger"
                size="lg"
                icon={<X size={20} />}
                onClick={() => handleSubmitInspection("REJECTED")}
                loading={submitting}
                disabled={submitting}
                className="font-black uppercase"
              >
                Reject
              </Button>
              <Button
                variant="success"
                size="lg"
                icon={<Check size={20} />}
                onClick={() => handleSubmitInspection("ACCEPTED")}
                loading={submitting}
                disabled={submitting}
                className="font-black uppercase"
              >
                Accept
              </Button>
            </div>

            {/* Submission error */}
            {error && (
              <div className="mt-4 p-4 rounded-lg bg-danger-50 border border-danger-200 text-danger-900">
                <p className="font-bold flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {error}
                </p>
              </div>
            )}

            {/* Info Message */}
            <div className="mt-4 p-4 bg-info-100 border border-info-300 rounded-lg text-center">
              <p className="text-info-900 font-bold text-sm">
                Choose Accept or Reject to complete the inspection
              </p>
              <p className="text-info-700 text-xs mt-1">
                This part will be sent to the inspector for final review
              </p>
            </div>
          </Card>
        )}

        {/* Scan History */}
        {scannedHistory.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <History size={20} className="text-gray-600" />
              <h3 className="text-lg font-black text-gray-900">Recent Scans</h3>
            </div>
            <div className="space-y-2">
              {scannedHistory.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div>
                    <p className="font-bold text-gray-900">{item.partNumber}</p>
                    <p className="text-sm font-mono text-gray-500">{item.barcode}</p>
                  </div>
                  <div className="text-right">
                    {item.machineName && (
                      <Badge variant="info" className="mb-1">{item.machineName}</Badge>
                    )}
                    <p className="text-xs text-gray-500">
                      {new Date(item.scannedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
