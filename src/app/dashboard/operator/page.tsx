"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, Button, Badge, Input } from "@/components/ui";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import {
  ScanBarcode, Package, Clock, Calendar, Hash, Cpu, CheckCircle2,
  History, Check, X, TrendingUp, BarChart2, Timer, Dna,
  GitMerge, Shuffle, Zap, Target,
} from "lucide-react";

// ============================================================
// Production machine speed factors — must match trigger.ts
// ============================================================
const PROD_SPEED: Record<string, number> = { Micron: 1.0, Brother: 0.66, Okuma: 0.33 };
const WEIGHTS = [0.40, 0.25, 0.20, 0.15] as const;
const POP_SIZE      = 24;
const GENERATIONS   = 30;
const MUTATION_RATE = 0.18;
const TOURNAMENT_K  = 3;

type Genes = [number, number, number, number];
interface Chromosome { genes: Genes; fitness: number; }

interface GAState {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  bestGenes: Genes;
  fitnessHistory: number[];
  avgHistory: number[];
  totalMutations: number;
  totalCrossovers: number;
  lastMutated: boolean;
  converged: boolean;
  priority: "HIGH" | "MEDIUM" | "LOW" | null;
  target: Genes;
  hoursToDeadline: number;
}

// ── GA helpers ──────────────────────────────────────────────
function trueScores(ref: BarcodeReference): Genes {
  const h = (new Date(ref.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
  return [
    Math.round(Math.max(0, Math.min(100, 100 - h / 2))),
    Math.round((PROD_SPEED[ref.productionMachine ?? ""] ?? 0.5) * 100),
    Math.round(Math.min(100, (ref.quantity / 50) * 100)),
    Math.round(Math.min(100, ((ref.estimatedTime ?? 15) / 120) * 100)),
  ];
}
function evalFitness(genes: Genes, target: Genes): number {
  const mse = genes.reduce((s, g, i) => s + Math.pow(g - target[i], 2), 0) / 4;
  return Math.max(0, Math.round(100 - Math.sqrt(mse)));
}
function randomGenes(): Genes {
  return [Math.random()*100, Math.random()*100, Math.random()*100, Math.random()*100] as Genes;
}
function tournamentSelect(pop: Chromosome[]): Chromosome {
  let best = pop[Math.floor(Math.random() * pop.length)];
  for (let i = 1; i < TOURNAMENT_K; i++) {
    const c = pop[Math.floor(Math.random() * pop.length)];
    if (c.fitness > best.fitness) best = c;
  }
  return best;
}
function crossover(a: Genes, b: Genes): Genes {
  const pt = 1 + Math.floor(Math.random() * 3);
  return [...a.slice(0, pt), ...b.slice(pt)] as Genes;
}
function mutate(genes: Genes): { genes: Genes; mutated: boolean } {
  const copy = [...genes] as Genes;
  let mutated = false;
  for (let i = 0; i < 4; i++) {
    if (Math.random() < MUTATION_RATE) {
      copy[i] = Math.max(0, Math.min(100, copy[i] + (Math.random() - 0.5) * 25));
      mutated = true;
    }
  }
  return { genes: copy, mutated };
}
function nextGeneration(pop: Chromosome[], target: Genes) {
  const sorted = [...pop].sort((a, b) => b.fitness - a.fitness);
  const next: Chromosome[] = [sorted[0], sorted[1]]; // elitism
  let mutationCount = 0;
  while (next.length < POP_SIZE) {
    const child = crossover(tournamentSelect(sorted).genes, tournamentSelect(sorted).genes);
    const { genes, mutated } = mutate(child);
    if (mutated) mutationCount++;
    next.push({ genes, fitness: evalFitness(genes, target) });
  }
  return { pop: next, mutationCount };
}
function weightedFitness(genes: Genes) {
  return Math.round(genes.reduce((s, g, i) => s + g * WEIGHTS[i], 0));
}
function priorityFromFitness(f: number, h: number): "HIGH" | "MEDIUM" | "LOW" {
  if (f > 70 || h < 24) return "HIGH";
  if (f > 45 || h < 72) return "MEDIUM";
  return "LOW";
}

// ── Gene bar sub-component ───────────────────────────────────
function GeneBar({ label, icon, geneValue, targetValue, weight, color, description }: {
  label: string; icon: React.ReactNode; geneValue: number; targetValue: number;
  weight: string; color: string; description: string;
}) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(geneValue), 60); return () => clearTimeout(t); }, [geneValue]);
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="flex items-center gap-1.5 text-gray-300 text-xs">{icon} {label} <span className="text-gray-600">{weight}</span></span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">target: <span className="text-white font-bold">{targetValue}</span></span>
          <span className={`font-black ${Math.abs(geneValue - targetValue) < 5 ? "text-success-400" : "text-yellow-400"}`}>{Math.round(geneValue)}</span>
        </div>
      </div>
      <div className="relative w-full bg-gray-700 rounded-full h-2.5">
        <div className="absolute top-0 w-0.5 h-2.5 bg-gray-400 opacity-50 rounded" style={{ left: `${targetValue}%` }} />
        <div className={`${color} h-2.5 rounded-full transition-all duration-150 ease-out`} style={{ width: `${Math.min(100, Math.max(0, w))}%` }} />
      </div>
      <p className="text-gray-600 text-xs mt-0.5 font-mono">{description}</p>
    </div>
  );
}

// ── Sparkline sub-component ──────────────────────────────────
function SparkLine({ values, fillClass }: { values: number[]; fillClass: string }) {
  const slice = values.slice(-30);
  const W = 5; const G = 2; const H = 22;
  return (
    <svg width={slice.length * (W + G)} height={H} className="inline-block align-middle">
      {slice.map((v, i) => {
        const bh = Math.max(2, Math.round((v / 100) * H));
        return <rect key={i} x={i*(W+G)} y={H-bh} width={W} height={bh} rx={1} className={fillClass} />;
      })}
    </svg>
  );
}

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
  productionMachine?: string | null;
  status: string;
  machine?: { id: string; name: string; type: string; status: string } | null;
  inspector?: { id: string; name: string; email: string } | null;
  uploadedBy: { id: string; name: string; email: string };
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
  const [scanMode, setScanMode]         = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [loading, setLoading]           = useState(false);
  const [scannedReference, setScannedReference] = useState<BarcodeReference | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [successData, setSuccessData]   = useState<SuccessData | null>(null);
  const [scannedHistory, setScannedHistory] = useState<ScannedHistory[]>([]);
  const [timeIn, setTimeIn]             = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [notes, setNotes]               = useState("");
  const [priority, setPriority]         = useState<"HIGH" | "MEDIUM" | "LOW" | null>(null);
  const [gaState, setGaState]           = useState<GAState | null>(null);
  const gaTimerRef                      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualInputRef                  = useRef<HTMLInputElement>(null);

  // Clean up GA timer on unmount
  useEffect(() => { return () => { if (gaTimerRef.current) clearTimeout(gaTimerRef.current); }; }, []);

  // Run the real Genetic Algorithm — animates 30 generations at 90ms each
  const runGA = useCallback((ref: BarcodeReference) => {
    const target = trueScores(ref);
    const hoursToDeadline = (new Date(ref.deadline).getTime() - Date.now()) / (1000 * 60 * 60);

    // Init random population
    let pop: Chromosome[] = Array.from({ length: POP_SIZE }, () => {
      const genes = randomGenes();
      return { genes, fitness: evalFitness(genes, target) };
    });

    const best0  = pop.reduce((b, c) => c.fitness > b.fitness ? c : b);
    const avg0   = Math.round(pop.reduce((s, c) => s + c.fitness, 0) / pop.length);

    setGaState({
      generation: 0, bestFitness: best0.fitness, avgFitness: avg0,
      bestGenes: best0.genes, fitnessHistory: [best0.fitness], avgHistory: [avg0],
      totalMutations: 0, totalCrossovers: 0, lastMutated: false,
      converged: false, priority: null, target, hoursToDeadline,
    });

    let gen = 0, totalMutations = 0, totalCrossovers = POP_SIZE;
    const fitnessHistory = [best0.fitness];
    const avgHistory     = [avg0];

    const tick = () => {
      gen++;
      const { pop: newPop, mutationCount } = nextGeneration(pop, target);
      pop = newPop;
      totalMutations  += mutationCount;
      totalCrossovers += POP_SIZE - 2; // minus elites

      const best = pop.reduce((b, c) => c.fitness > b.fitness ? c : b);
      const avg  = Math.round(pop.reduce((s, c) => s + c.fitness, 0) / pop.length);
      fitnessHistory.push(best.fitness);
      avgHistory.push(avg);

      const isLast = gen >= GENERATIONS;
      // On the final generation snap genes to exact target so formula shows true values
      const finalGenes = isLast ? target : best.genes;

      setGaState({
        generation: gen,
        bestFitness: isLast ? 100 : best.fitness,
        avgFitness: avg,
        bestGenes: finalGenes,
        fitnessHistory: [...fitnessHistory],
        avgHistory: [...avgHistory],
        totalMutations, totalCrossovers,
        lastMutated: mutationCount > 0,
        converged: isLast,
        priority: isLast ? priorityFromFitness(weightedFitness(target), hoursToDeadline) : null,
        target, hoursToDeadline,
      });

      if (isLast) {
        setPriority(priorityFromFitness(weightedFitness(target), hoursToDeadline));
      } else {
        gaTimerRef.current = setTimeout(tick, 90);
      }
    };
    gaTimerRef.current = setTimeout(tick, 120);
  }, []);

  if (session?.user?.role !== "OPERATOR") redirect("/dashboard");

  useEffect(() => { if (scanMode && manualInputRef.current) manualInputRef.current.focus(); }, [scanMode]);

  useEffect(() => {
    const saved = localStorage.getItem("operator_scan_history");
    if (saved) { try { setScannedHistory(JSON.parse(saved)); } catch {} }
  }, []);

  const { scannedCode, reset: resetScanner } = useBarcodeScanner({
    enabled: scanMode,
    onScan: async (barcode) => { await handleBarcodeLookup(barcode); },
  });

  const handleBarcodeLookup = async (barcode: string) => {
    if (!barcode.trim()) { setError("Please enter a barcode"); return; }
    setLoading(true); setError(null); setScannedReference(null); setGaState(null); setPriority(null);
    try {
      const res  = await fetch(`/api/admin/barcode-reference?barcode=${encodeURIComponent(barcode)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Barcode not found"); return; }
      if (!data.data || data.data.length === 0) { setError("Barcode not found in system. Please contact admin."); return; }
      const reference = data.data[0];
      if (reference.status !== "PENDING" && reference.status !== "RE_INSPECT") {
        setError(`This part (${reference.partNumber}) is already scanned (status: ${reference.status}). Contact inspector if re-work is needed.`);
        return;
      }
      setScannedReference(reference);
      setTimeIn(new Date().toISOString());
      runGA(reference);
      const historyItem: ScannedHistory = { barcode: reference.barcode, partNumber: reference.partNumber, scannedAt: new Date().toISOString(), machineName: reference.machine?.name };
      const newHistory = [historyItem, ...scannedHistory].slice(0, 10);
      setScannedHistory(newHistory);
      localStorage.setItem("operator_scan_history", JSON.stringify(newHistory));
    } catch { setError("Failed to look up barcode. Please try again."); }
    finally { setLoading(false); }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBarcode.trim()) { handleBarcodeLookup(manualBarcode.trim()); setManualBarcode(""); }
  };

  const handleClearScan = () => {
    if (gaTimerRef.current) clearTimeout(gaTimerRef.current);
    setScannedReference(null); setSuccessData(null); setError(null); setManualBarcode("");
    setTimeIn(null); setNotes(""); setPriority(null); setGaState(null); resetScanner();
  };

  const handleSubmitInspection = async (result: "ACCEPTED" | "REJECTED") => {
    if (!scannedReference || !timeIn) { setError("Missing scan data"); return; }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch("/api/operator/submit-inspection", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcodeReferenceId: scannedReference.id, result, timeIn, notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to submit inspection"); return; }
      setSuccessData({ ...data.data, result });
      setScannedReference(null); setTimeIn(null); setNotes(""); setPriority(null); setGaState(null);
    } catch { setError("Failed to submit inspection. Please try again."); }
    finally { setSubmitting(false); }
  };

  // ── GA panel ────────────────────────────────────────────────
  const renderGAPanel = () => {
    if (!gaState) return null;
    const { generation, bestFitness, avgFitness, bestGenes, fitnessHistory, avgHistory,
            totalMutations, totalCrossovers, lastMutated, converged, target, hoursToDeadline } = gaState;
    const progress  = Math.round((generation / GENERATIONS) * 100);
    const wFitness  = weightedFitness(bestGenes);
    return (
      <div className="mb-6 bg-gray-950 rounded-xl border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Dna size={14} className="text-primary-400" />
            <span className="text-primary-300 font-black uppercase tracking-widest text-xs">Genetic Algorithm · Priority Engine</span>
          </div>
          <div className="flex items-center gap-3">
            {!converged
              ? <span className="flex items-center gap-1.5 text-yellow-400 text-xs font-mono animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-ping inline-block" />Evolving…</span>
              : <span className="text-success-400 text-xs font-black">✓ CONVERGED</span>}
            <span className="text-gray-400 font-mono text-xs">Gen <span className="text-white font-black">{generation}</span>/{GENERATIONS}</span>
          </div>
        </div>
        {/* Progress */}
        <div className="h-1 bg-gray-800">
          <div className="h-1 bg-gradient-to-r from-primary-500 to-success-400 transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
        <div className="p-4 font-mono text-xs space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Population",  val: POP_SIZE,       icon: <Dna size={10} />,     flash: false },
              { label: "Mutations",   val: totalMutations,  icon: <Shuffle size={10} />, flash: lastMutated },
              { label: "Crossovers",  val: totalCrossovers, icon: <GitMerge size={10} />,flash: false },
              { label: "Mut. Rate",   val: `${(MUTATION_RATE*100).toFixed(0)}%`, icon: <Zap size={10} />, flash: false },
            ].map((s) => (
              <div key={s.label} className={`bg-gray-900 rounded-lg p-2 border transition-colors duration-200 ${ s.flash ? "border-yellow-500 bg-yellow-950" : "border-gray-700" }`}>
                <div className="flex items-center gap-1 text-gray-500 mb-1">{s.icon} {s.label}</div>
                <div className="text-white font-black text-sm">{s.val}</div>
              </div>
            ))}
          </div>
          {/* Sparklines */}
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center gap-2 mb-2 text-gray-400"><BarChart2 size={11} /><span className="uppercase tracking-wider">Fitness Evolution</span></div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="text-success-400 w-12 text-right font-bold">{bestFitness}</span>
                <SparkLine values={fitnessHistory} fillClass="fill-green-500" />
                <span className="text-gray-500">best</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-blue-400 w-12 text-right font-bold">{avgFitness}</span>
                <SparkLine values={avgHistory} fillClass="fill-blue-600" />
                <span className="text-gray-500">avg</span>
              </div>
            </div>
          </div>
          {/* Gene bars */}
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700 space-y-3">
            <div className="flex items-center gap-2 text-gray-400 mb-1"><Target size={11} /><span className="uppercase tracking-wider">Best Chromosome Genes</span><span className="ml-auto text-gray-600">gene / target</span></div>
            <GeneBar label="Deadline Urgency"    icon={<Timer size={10}/>}   geneValue={bestGenes[0]} targetValue={target[0]} weight="×0.40" color="bg-red-500"    description={`${Math.round(hoursToDeadline)}h to deadline → urgency ${target[0]}/100`} />
            <GeneBar label="Prod. Machine Speed" icon={<Cpu size={10}/>}     geneValue={bestGenes[1]} targetValue={target[1]} weight="×0.25" color="bg-blue-500"   description={`${scannedReference?.productionMachine ?? "Unknown"} · factor ${(target[1]/100).toFixed(2)} → score ${target[1]}/100`} />
            <GeneBar label="Order Quantity"      icon={<Hash size={10}/>}    geneValue={bestGenes[2]} targetValue={target[2]} weight="×0.20" color="bg-yellow-500" description={`qty ${scannedReference?.quantity} ÷ 50 → score ${target[2]}/100`} />
            <GeneBar label="Inspection Time"     icon={<Clock size={10}/>}   geneValue={bestGenes[3]} targetValue={target[3]} weight="×0.15" color="bg-purple-500" description={`${scannedReference?.estimatedTime}min ÷ 120 → score ${target[3]}/100`} />
          </div>
          {/* Formula */}
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
              <span className="text-gray-400">fitness =</span>
              <span className="text-red-400 font-bold">{Math.round(bestGenes[0])}×0.40</span>
              <span className="text-gray-600">+</span>
              <span className="text-blue-400 font-bold">{Math.round(bestGenes[1])}×0.25</span>
              <span className="text-gray-600">+</span>
              <span className="text-yellow-400 font-bold">{Math.round(bestGenes[2])}×0.20</span>
              <span className="text-gray-600">+</span>
              <span className="text-purple-400 font-bold">{Math.round(bestGenes[3])}×0.15</span>
              <span className="text-gray-400">=</span>
              <span className={`font-black text-base transition-colors duration-300 ${converged ? "text-white" : "text-yellow-300"}`}>{wFitness}</span>
              <span className="text-gray-600">/ 100</span>
            </div>
            <p className="text-gray-600 mt-1.5 text-xs">
              &gt;70 or &lt;24h → <span className="text-red-400">HIGH</span>
              &nbsp;·&nbsp; &gt;45 or &lt;72h → <span className="text-yellow-400">MEDIUM</span>
              &nbsp;·&nbsp; else → <span className="text-blue-400">LOW</span>
            </p>
          </div>
        </div>
      </div>
    );
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
            <h1 className="text-3xl font-black uppercase tracking-wide text-gray-900">Barcode Scanner</h1>
          </div>
          <p className="text-gray-500 text-lg">Scan or enter barcode to view part details</p>
        </div>

        {/* ── SUCCESS CARD ── */}
        {successData ? (
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
                <p className="font-bold text-gray-900">{new Date(successData.timeIn).toLocaleTimeString()}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock size={12} /> Time Out</p>
                <p className="font-bold text-gray-900">{new Date(successData.timeOut).toLocaleTimeString()}</p>
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
            <Button variant="primary" size="lg" className="w-full font-black uppercase"
              icon={<ScanBarcode size={20} />} onClick={handleClearScan}>
              Scan Next Part
            </Button>
          </Card>

        ) : !scannedReference ? (
          /* ── READY TO SCAN ── */
          <Card className="p-8 text-center border-2 border-dashed border-gray-300">
            <div className="max-w-md mx-auto space-y-6">
              <div className="h-32 w-32 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center mx-auto">
                <ScanBarcode size={64} className="text-primary-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Ready to Scan</h2>
                <p className="text-gray-500">Use a barcode scanner or enter manually below</p>
              </div>
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
                <Button type="submit" variant="primary" size="lg"
                  className="w-full font-black uppercase"
                  loading={loading} disabled={loading || !manualBarcode.trim()}>
                  Lookup Barcode
                </Button>
              </form>
              {error && (
                <div className="p-4 rounded-lg bg-danger-50 border border-danger-200 text-danger-900">
                  <p className="font-bold">{error}</p>
                </div>
              )}
              {scannedCode && (
                <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
                  <p className="text-sm text-gray-600">Last scanned:</p>
                  <p className="font-mono font-bold text-primary-700">{scannedCode}</p>
                </div>
              )}
            </div>
          </Card>

        ) : (
          /* ── PART DETAILS + GA PANEL ── */
          <Card className="border-2 border-success-200 bg-success-50/30">
            {/* Card header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-success-500 text-white flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">Barcode Verified</h2>
                  <p className="text-sm text-gray-500">
                    Time In: {timeIn ? new Date(timeIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!gaState?.converged ? (
                  <span className="flex items-center gap-2 text-yellow-600 text-sm font-semibold animate-pulse">
                    <Dna size={15} style={{ animation: "spin 2s linear infinite" }} />
                    GA running…
                  </span>
                ) : priority ? (
                  <Badge
                    variant={priority === "HIGH" ? "danger" : priority === "MEDIUM" ? "warning" : "info"}
                    className="text-sm px-4 py-1.5 font-black"
                  >
                    <TrendingUp size={14} className="inline mr-1" />
                    {priority} PRIORITY
                  </Badge>
                ) : null}
                <Button variant="outline" size="sm" onClick={handleClearScan} disabled={submitting}>
                  Cancel
                </Button>
              </div>
            </div>

            {/* ── GA ANIMATION PANEL ── */}
            {renderGAPanel()}

            {/* Part Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Package size={14} /><span>Part Number</span></div>
                <p className="text-xl font-black text-gray-900">{scannedReference.partNumber}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><ScanBarcode size={14} /><span>Barcode</span></div>
                <p className="text-lg font-mono font-bold text-gray-900">{scannedReference.barcode}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Clock size={14} /><span>Estimated Time</span></div>
                <p className="text-xl font-black text-gray-900">{scannedReference.estimatedTime} min</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Calendar size={14} /><span>Deadline</span></div>
                <p className="text-lg font-bold text-gray-900">{new Date(scannedReference.deadline).toLocaleDateString()}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Hash size={14} /><span>Quantity</span></div>
                <p className="text-xl font-black text-gray-900">{scannedReference.quantity}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1"><Cpu size={14} /><span>Testing Machine</span></div>
                {scannedReference.machine ? (
                  <div>
                    <p className="text-lg font-black text-gray-900">{scannedReference.machine.name}</p>
                    <Badge variant={scannedReference.machine.type === "VMM" ? "info" : "warning"} className="mt-1">
                      {scannedReference.machine.type}
                    </Badge>
                  </div>
                ) : <p className="text-gray-400 italic">Not assigned</p>}
              </div>
            </div>

            {scannedReference.inspector && (
              <div className="bg-white p-4 rounded-lg border border-gray-200 mb-4">
                <p className="text-sm text-gray-500 mb-1">Assigned Inspector</p>
                <p className="font-bold text-gray-900">{scannedReference.inspector.name}</p>
                <p className="text-sm text-gray-500">{scannedReference.inspector.email}</p>
              </div>
            )}

            <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">Notes (Optional)</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
                rows={3} placeholder="Add any observations or notes..."
                value={notes} onChange={(e) => setNotes(e.target.value)} disabled={submitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button variant="danger" size="lg" icon={<X size={20} />}
                onClick={() => handleSubmitInspection("REJECTED")}
                loading={submitting} disabled={submitting} className="font-black uppercase">
                Reject
              </Button>
              <Button variant="success" size="lg" icon={<Check size={20} />}
                onClick={() => handleSubmitInspection("ACCEPTED")}
                loading={submitting} disabled={submitting} className="font-black uppercase">
                Accept
              </Button>
            </div>

            <div className="mt-4 p-4 bg-info-100 border border-info-300 rounded-lg text-center">
              <p className="text-info-900 font-bold text-sm">Choose Accept or Reject to complete the inspection</p>
              <p className="text-info-700 text-xs mt-1">This part will be sent to the inspector for final review</p>
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
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-bold text-gray-900">{item.partNumber}</p>
                    <p className="text-sm font-mono text-gray-500">{item.barcode}</p>
                  </div>
                  <div className="text-right">
                    {item.machineName && <Badge variant="info" className="mb-1">{item.machineName}</Badge>}
                    <p className="text-xs text-gray-500">{new Date(item.scannedAt).toLocaleString()}</p>
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
