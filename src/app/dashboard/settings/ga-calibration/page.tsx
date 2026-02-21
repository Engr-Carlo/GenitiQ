"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, Button } from "@/components/ui";
import { SlidersHorizontal, Target, Clock, TrendingUp, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

interface Thresholds {
  highFitnessThreshold: number;
  highHoursThreshold: number;
  mediumFitnessThreshold: number;
  mediumHoursThreshold: number;
}

const DEFAULTS: Thresholds = {
  highFitnessThreshold: 70,
  highHoursThreshold: 24,
  mediumFitnessThreshold: 45,
  mediumHoursThreshold: 72,
};

// "Precision" = how strictly HIGH/MEDIUM are called; "Accuracy" = how well defaults match real-world data
function computeMetrics(t: Thresholds) {
  const highRange  = 100 - t.highFitnessThreshold;
  const lowRange   = t.mediumFitnessThreshold;
  const total      = 100;
  const precision  = Math.round(100 - (highRange / total) * 100);         // stricter threshold = higher precision
  const recall     = Math.round((highRange / total) * 100);               // looser = higher recall / sensitivity
  const urgencyBias = Math.round(Math.max(0, 100 - t.highHoursThreshold / 2)); // smaller hours window = more urgent
  const balance    = 100 - Math.abs(highRange - lowRange);                // how balanced the three zones are
  return { precision, recall, urgencyBias, balance: Math.max(0, balance) };
}

function ZoneDiagram({ t }: { t: Thresholds }) {
  const high = 100 - t.highFitnessThreshold;
  const med  = t.highFitnessThreshold - t.mediumFitnessThreshold;
  const low  = t.mediumFitnessThreshold;
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Fitness Score Decision Zones (0–100)</p>
      <div className="flex rounded-lg overflow-hidden h-8 text-xs font-bold">
        <div className="flex items-center justify-center text-white bg-blue-500 transition-all duration-300" style={{ width: `${low}%` }}>
          {low >= 10 ? `LOW (0–${Math.round(t.mediumFitnessThreshold)})` : "L"}
        </div>
        <div className="flex items-center justify-center text-white bg-amber-500 transition-all duration-300" style={{ width: `${med}%` }}>
          {med >= 14 ? `MED (${Math.round(t.mediumFitnessThreshold)}–${Math.round(t.highFitnessThreshold)})` : "M"}
        </div>
        <div className="flex items-center justify-center text-white bg-red-500 transition-all duration-300" style={{ width: `${high}%` }}>
          {high >= 10 ? `HIGH (>${Math.round(t.highFitnessThreshold)})` : "H"}
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2 uppercase tracking-wider">Hours-to-Deadline Urgency Bands</p>
      <div className="flex rounded-lg overflow-hidden h-8 text-xs font-bold mt-2">
        {/* deadline bands: 0..highH = HIGH, highH..medH = MEDIUM, medH..∞ = LOW (we show up to 168h = 7 days) */}
        {(() => {
          const maxH = 168;
          const highW = Math.round((t.highHoursThreshold / maxH) * 100);
          const medW  = Math.round(((t.mediumHoursThreshold - t.highHoursThreshold) / maxH) * 100);
          const lowW  = Math.max(0, 100 - highW - medW);
          return <>
            <div className="flex items-center justify-center text-white bg-red-500 transition-all duration-300" style={{ width: `${highW}%` }}>
              {highW >= 10 ? `HIGH (<${Math.round(t.highHoursThreshold)}h)` : "H"}
            </div>
            <div className="flex items-center justify-center text-white bg-amber-500 transition-all duration-300" style={{ width: `${medW}%` }}>
              {medW >= 14 ? `MED (<${Math.round(t.mediumHoursThreshold)}h)` : "M"}
            </div>
            <div className="flex items-center justify-center text-white bg-blue-500 transition-all duration-300" style={{ width: `${lowW}%` }}>
              {lowW >= 10 ? "LOW" : "L"}
            </div>
          </>;
        })()}
      </div>
      <p className="text-xs text-gray-400 mt-1">Scale: 0 → 168 h (7 days)</p>
    </div>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-bold text-gray-700">{value}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-300`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function SliderField({
  label, description, value, min, max, step = 1,
  onChange, unit = "", color,
}: {
  label: string; description: string; value: number; min: number; max: number;
  step?: number; onChange: (v: number) => void; unit?: string; color: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        <div className={`text-xl font-black ${color} min-w-[60px] text-right`}>
          {value}{unit}
        </div>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

export default function GACalibrationPage() {
  const { data: session, status } = useSession();
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULTS);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [result, setResult]     = useState<{ success: boolean; message: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") redirect("/login");
    if (session && session.user.role !== "ADMIN") redirect("/dashboard");
  }, [session, status]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ga-config");
      const data = await res.json();
      if (data.data) {
        setThresholds({
          highFitnessThreshold:   data.data.highFitnessThreshold   ?? 70,
          highHoursThreshold:     data.data.highHoursThreshold     ?? 24,
          mediumFitnessThreshold: data.data.mediumFitnessThreshold ?? 45,
          mediumHoursThreshold:   data.data.mediumHoursThreshold   ?? 72,
        });
        if (data.data.updatedAt) {
          setLastUpdated(new Date(data.data.updatedAt).toLocaleString());
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (session?.user.role === "ADMIN") fetchConfig(); }, [session, fetchConfig]);

  const handleSave = async () => {
    setResult(null);
    // Client-side validation
    if (thresholds.highFitnessThreshold <= thresholds.mediumFitnessThreshold) {
      setResult({ success: false, message: "HIGH fitness threshold must be greater than MEDIUM." });
      return;
    }
    if (thresholds.highHoursThreshold >= thresholds.mediumHoursThreshold) {
      setResult({ success: false, message: "HIGH hours threshold must be less than MEDIUM hours threshold." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/ga-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(thresholds),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: "Thresholds saved successfully. The operator page will use the new values immediately." });
        setLastUpdated(new Date().toLocaleString());
      } else {
        setResult({ success: false, message: data.error || "Failed to save." });
      }
    } catch {
      setResult({ success: false, message: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setThresholds(DEFAULTS);
    setResult(null);
  };

  const metrics = computeMetrics(thresholds);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <RefreshCw className="animate-spin mr-2" size={18} /> Loading configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white">
            <SlidersHorizontal size={22} />
          </div>
          GA Priority Calibration
        </h1>
        <p className="text-gray-500 mt-1 ml-13 text-sm">
          Adjust thresholds that control when a part is classified as <strong className="text-red-600">HIGH</strong>,{" "}
          <strong className="text-amber-600">MEDIUM</strong>, or <strong className="text-blue-600">LOW</strong> priority
          by the Genetic Algorithm engine.
          {lastUpdated && <span className="ml-2 text-xs text-gray-400">Last updated: {lastUpdated}</span>}
        </p>
      </div>

      {/* Zone Diagram */}
      <Card>
        <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
          <Target size={15} /> Live Classification Preview
        </h2>
        <ZoneDiagram t={thresholds} />
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fitness Thresholds */}
        <Card>
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
            <TrendingUp size={15} /> Fitness Score Thresholds
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Fitness score (0–100) is the weighted sum of all 4 gene values. A higher score = more urgent part.
          </p>
          <div className="space-y-6">
            <SliderField
              label="HIGH Priority — Fitness"
              description="Score above this → HIGH priority"
              value={thresholds.highFitnessThreshold}
              min={50} max={95} step={1}
              onChange={v => setThresholds(p => ({ ...p, highFitnessThreshold: v }))}
              color="text-red-600"
            />
            <SliderField
              label="MEDIUM Priority — Fitness"
              description="Score above this (but below HIGH) → MEDIUM"
              value={thresholds.mediumFitnessThreshold}
              min={10} max={Math.max(10, thresholds.highFitnessThreshold - 5)} step={1}
              onChange={v => setThresholds(p => ({ ...p, mediumFitnessThreshold: v }))}
              color="text-amber-600"
            />
          </div>
        </Card>

        {/* Hours-to-Deadline Thresholds */}
        <Card>
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
            <Clock size={15} /> Hours-to-Deadline Thresholds
          </h2>
          <p className="text-xs text-gray-400 mb-5">
            Even if the fitness score is low, a part is escalated if the deadline is approaching.
          </p>
          <div className="space-y-6">
            <SliderField
              label="HIGH Priority — Deadline"
              description="Fewer hours remaining → forced HIGH"
              value={thresholds.highHoursThreshold}
              min={1} max={Math.min(48, thresholds.mediumHoursThreshold - 1)} step={1}
              onChange={v => setThresholds(p => ({ ...p, highHoursThreshold: v }))}
              unit="h"
              color="text-red-600"
            />
            <SliderField
              label="MEDIUM Priority — Deadline"
              description="Fewer hours remaining → forced MEDIUM"
              value={thresholds.mediumHoursThreshold}
              min={Math.max(2, thresholds.highHoursThreshold + 1)} max={168} step={1}
              onChange={v => setThresholds(p => ({ ...p, mediumHoursThreshold: v }))}
              unit="h"
              color="text-amber-600"
            />
          </div>
        </Card>
      </div>

      {/* Model Metrics */}
      <Card>
        <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
          <Target size={15} /> Estimated Model Characteristics
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          These indicators update as you move the sliders, showing the trade-offs of the current threshold configuration.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <MetricBar label="Precision (fewer false HIGHs)" value={metrics.precision}  color="bg-indigo-500" />
            <MetricBar label="Recall (catch more HIGHs)"      value={metrics.recall}    color="bg-green-500" />
          </div>
          <div className="space-y-3">
            <MetricBar label="Deadline Urgency Sensitivity"  value={metrics.urgencyBias} color="bg-red-500" />
            <MetricBar label="Zone Balance"                  value={metrics.balance}     color="bg-amber-500" />
          </div>
        </div>
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
          <p><strong>Precision ↑</strong> — raises the HIGH bar; fewer parts are marked HIGH (reduces false alarms).</p>
          <p><strong>Recall ↑</strong> — lowers the HIGH bar; more parts qualify as HIGH (catches more urgent cases).</p>
          <p><strong>Deadline Sensitivity ↑</strong> — parts are escalated to HIGH sooner when deadline approaches.</p>
          <p><strong>Zone Balance ↑</strong> — the three priority bands (HIGH / MEDIUM / LOW) are roughly equal width.</p>
        </div>
      </Card>

      {/* Rule Summary */}
      <Card>
        <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
          <Target size={15} /> Current Classification Rules
        </h2>
        <div className="space-y-2 text-sm font-mono">
          <div className="flex items-center gap-3 p-2 bg-red-50 rounded-lg border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            <span className="text-red-800 font-bold">HIGH</span>
            <span className="text-red-700">if fitness &gt; <strong>{thresholds.highFitnessThreshold}</strong> <em>or</em> deadline &lt; <strong>{thresholds.highHoursThreshold}h</strong></span>
          </div>
          <div className="flex items-center gap-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
            <span className="text-amber-800 font-bold">MEDIUM</span>
            <span className="text-amber-700">if fitness &gt; <strong>{thresholds.mediumFitnessThreshold}</strong> <em>or</em> deadline &lt; <strong>{thresholds.mediumHoursThreshold}h</strong></span>
          </div>
          <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            <span className="text-blue-800 font-bold">LOW</span>
            <span className="text-blue-700">everything else</span>
          </div>
        </div>
      </Card>

      {/* Result Banner */}
      {result && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border ${result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          {result.success ? <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" /> : <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />}
          <p className={`text-sm ${result.success ? "text-green-800" : "text-red-800"}`}>{result.message}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pb-6">
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={saving} icon={<CheckCircle2 size={15} />}>
          Save Thresholds
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={saving} icon={<RefreshCw size={15} />}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
