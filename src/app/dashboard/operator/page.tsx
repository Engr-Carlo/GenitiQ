"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Card, Button, Badge, Input,
} from "@/components/ui";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import {
  ScanBarcode, Package, Clock, Calendar, Hash, Cpu, CheckCircle2, History,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface BarcodeReference {
  id: string;
  partNumber: string;
  barcode: string;
  estimatedTime: number;
  deadline: string;
  quantity: number;
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
  const [scannedHistory, setScannedHistory] = useState<ScannedHistory[]>([]);
  const manualInputRef = useRef<HTMLInputElement>(null);

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
      setScannedReference(reference);

      // Save to history
      const historyItem: ScannedHistory = {
        barcode: reference.barcode,
        partNumber: reference.partNumber,
        scannedAt: new Date().toISOString(),
        machineName: reference.machine?.name,
      };
      const newHistory = [historyItem, ...scannedHistory].slice(0, 10); // Keep last 10
      setScannedHistory(newHistory);
      localStorage.setItem("operator_scan_history", JSON.stringify(newHistory));

      // Mark as scanned in database (tracking)
      await fetch(`/api/barcode-scanned/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcodeReferenceId: reference.id }),
      }).catch(console.error);
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
    setError(null);
    setManualBarcode("");
    setScanMode(false);
    resetScanner();
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
        {!scannedReference ? (
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
          // Barcode Details Display
          <Card className="border-2 border-success-200 bg-success-50/30">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-success-500 text-white flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">Barcode Verified</h2>
                  <p className="text-sm text-gray-500">Reference details loaded successfully</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleClearScan}>
                Scan Another
              </Button>
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
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Assigned Inspector</p>
                <p className="font-bold text-gray-900">{scannedReference.inspector.name}</p>
                <p className="text-sm text-gray-500">{scannedReference.inspector.email}</p>
              </div>
            )}

            {/* Success Message */}
            <div className="mt-6 p-4 bg-success-100 border border-success-300 rounded-lg text-center">
              <p className="text-success-900 font-bold text-lg">
                ✓ Barcode scan logged successfully
              </p>
              <p className="text-success-700 text-sm mt-1">
                Inspector will proceed with the inspection
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
