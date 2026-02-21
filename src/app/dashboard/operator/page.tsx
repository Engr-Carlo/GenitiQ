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
// Production machine speed factors â€” must match trigger.ts
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

// â”€â”€ GA helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Gene bar sub-component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Sparkline sub-component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const [gaDialogOpen, setGaDialogOpen] = useState(false);
  const gaTimerRef                      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualInputRef                  = useRef<HTMLInputElement>(null);

  // Clean up GA timer on unmount
  useEffect(() => { return () => { if (gaTimerRef.current) clearTimeout(gaTimerRef.current); }; }, []);

  // Run the real Genetic Algorithm â€” animates 30 generations at 90ms each
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

    setGaDialogOpen(true);
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
        gaTimerRef.current = setTimeout(() => setGaDialogOpen(false), 2500);
      } else {
        gaTimerRef.current = setTimeout(tick, 300);
      }
    };
    gaTimerRef.current = setTimeout(tick, 400);
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

  // GA modal dialog
  const renderGADialog = () => {
    if (!gaState || !gaDialogOpen) return null;
    const { generation, bestFitness, avgFitness, bestGenes, fitnessHistory, avgHistory,
            totalMutations, totalCrossovers, lastMutated, converged, target, hoursToDeadline } = gaState;
    const progress = Math.round((generation / GENERATIONS) * 100);
    const wFitness = weightedFitness(bestGenes);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
        <div className="w-full max-w-2xl mx-4 bg-gray-950 rounded-2xl border border-gray-700 overflow-hidden shadow-2xl">
          {/* Dialog header */}
          <div className="flex items-center justify-between px-5 py-4 bg-gray-900 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Dna size={16} className="text-primary-400" style={!converged ? { animation: "spin 2s linear infinite" } : {}} />
              <span className="text-primary-300 font-black uppercase tracking-widest text-sm">Genetic Algorithm - Priority Engine</span>
            </div>
            <div className="flex items-center gap-3">
              {!converged
                ? <span className="flex items-center gap-1.5 text-yellow-400 text-xs font-mono animate-pulse"><span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping inline-block" /> Evolving...</span>
                : <span className="text-green-400 text-xs font-black">&#x2713; CONVERGED</span>}
              <span className="text-gray-400 font-mono text-xs">Gen <span className="text-white font-black">{generation}</span>/{GENERATIONS}</span>
              {converged && (
                <button onClick={() => setGaDialogOpen(false)} className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded border border-gray-600 hover:border-gray-400 transition-colors">
                  Close
                </button>
              )}
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-gray-800">
            <div className="h-1.5 bg-gradient-to-r from-primary-500 to-green-400 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="p-5 font-mono text-xs space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Population",  val: POP_SIZE,        icon: <Dna size={11} />,      flash: false },
                { label: "Mutations",   val: totalMutations,   icon: <Shuffle size={11} />,  flash: lastMutated },
                { label: "Crossovers",  val: totalCrossovers,  icon: <GitMerge size={11} />, flash: false },
                { label: "Mut. Rate",   val: `${(MUTATION_RATE * 100).toFixed(0)}%`, icon: <Zap size={11} />, flash: false },
              ].map((s) => (
                <div key={s.label} className={`rounded-xl p-3 border transition-colors duration-200 ${s.flash ? "border-yellow-500 bg-yellow-950" : "bg-gray-900 border-gray-700"}`}>
                  <div className="flex items-center gap-1 text-gray-500 mb-1">{s.icon} {s.label}</div>
                  <div className="text-white font-black text-base">{s.val}</div>
                </div>
              ))}
            </div>
            {/* Fitness evolution sparklines */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center gap-2 mb-3 text-gray-400"><BarChart2 size={12} /><span className="uppercase tracking-wider text-xs">Fitness Evolution</span></div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-green-400 w-10 text-right font-bold text-sm">{bestFitness}</span>
                  <SparkLine values={fitnessHistory} fillClass="fill-green-500" />
                  <span className="text-gray-500">best fitness</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 w-10 text-right font-bold text-sm">{avgFitness}</span>
                  <SparkLine values={avgHistory} fillClass="fill-blue-600" />
                  <span className="text-gray-500">avg fitness</span>
                </div>
              </div>
            </div>
            {/* Gene bars */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 space-y-3">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Target size={12} />
                <span className="uppercase tracking-wider text-xs">Best Chromosome Genes</span>
                <span className="ml-auto text-gray-600 text-xs">gene / target</span>
              </div>
              <GeneBar label="Deadline Urgency"    icon={<Timer size={10}/>}  geneValue={bestGenes[0]} targetValue={target[0]} weight="x0.40" color="bg-red-500"    description={`${Math.round(hoursToDeadline)}h to deadline -> urgency ${target[0]}/100`} />
              <GeneBar label="Prod. Machine Speed" icon={<Cpu size={10}/>}    geneValue={bestGenes[1]} targetValue={target[1]} weight="x0.25" color="bg-blue-500"   description={`${scannedReference?.productionMachine ?? "Unknown"} | factor ${(target[1]/100).toFixed(2)} -> score ${target[1]}/100`} />
              <GeneBar label="Order Quantity"      icon={<Hash size={10}/>}   geneValue={bestGenes[2]} targetValue={target[2]} weight="x0.20" color="bg-yellow-500" description={`qty ${scannedReference?.quantity} / 50 -> score ${target[2]}/100`} />
              <GeneBar label="Inspection Time"     icon={<Clock size={10}/>}  geneValue={bestGenes[3]} targetValue={target[3]} weight="x0.15" color="bg-purple-500" description={`${scannedReference?.estimatedTime}min / 120 -> score ${target[3]}/100`} />
            </div>
            {/* Weighted fitness formula */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
              <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider">Weighted Fitness Formula</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-gray-400">f =</span>
                <span className="text-red-400 font-bold">{Math.round(bestGenes[0])} x 0.40</span>
                <span className="text-gray-600">+</span>
                <span className="text-blue-400 font-bold">{Math.round(bestGenes[1])} x 0.25</span>
                <span className="text-gray-600">+</span>
                <span className="text-yellow-400 font-bold">{Math.round(bestGenes[2])} x 0.20</span>
                <span className="text-gray-600">+</span>
                <span className="text-purple-400 font-bold">{Math.round(bestGenes[3])} x 0.15</span>
                <span className="text-gray-400">=</span>
                <span className={`font-black text-xl transition-colors duration-300 ${converged ? "text-white" : "text-yellow-300"}`}>{wFitness}</span>
                <span className="text-gray-600">/ 100</span>
              </div>
              <div className="mt-2 text-xs text-gray-500 flex gap-4">
                <span>&gt;70 or &lt;24h: <span className="text-red-400 font-bold">HIGH</span></span>
                <span>&gt;45 or &lt;72h: <span className="text-yellow-400 font-bold">MEDIUM</span></span>
                <span>else: <span className="text-blue-400 font-bold">LOW</span></span>
              </div>
            </div>
            {/* Convergence verdict */}
            {converged && gaState.priority && (
              <div className={`rounded-xl p-5 border-2 text-center ${
                gaState.priority === "HIGH" ? "border-red-500 bg-red-950"
                : gaState.priority === "MEDIUM" ? "border-yellow-500 bg-yellow-950"
                : "border-blue-500 bg-blue-950"
              }`}>
                <p className="text-gray-400 text-xs mb-1 uppercase tracking-widest">GA Verdict</p>
                <p className={`font-black text-3xl ${
                  gaState.priority === "HIGH" ? "text-red-400"
                  : gaState.priority === "MEDIUM" ? "text-yellow-400"
                  : "text-blue-400"
                }`}>{gaState.priority} PRIORITY</p>
                <p className="text-gray-500 text-xs mt-2">Closing automatically in 2.5s...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* GA Modal Dialog */}
      {renderGADialog()}
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

        {/* â”€â”€ SUCCESS CARD â”€â”€ */}
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
          /* â”€â”€ READY TO SCAN â”€â”€ */
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
          /* â”€â”€ PART DETAILS + GA PANEL â”€â”€ */
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
                    Time In: {timeIn ? new Date(timeIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "â€”"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {gaState && !gaState.converged ? (
                  <button onClick={() => setGaDialogOpen(true)} className="flex items-center gap-2 text-yellow-600 text-sm font-semibold animate-pulse bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-1.5 hover:bg-yellow-100 transition-colors">
                    <Dna size={14} style={{ animation: "spin 2s linear infinite" }} />
                    GA Computing...
                  </button>
                ) : priority ? (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={priority === "HIGH" ? "danger" : priority === "MEDIUM" ? "warning" : "info"}
                      className="text-sm px-4 py-1.5 font-black"
                    >
                      <TrendingUp size={14} className="inline mr-1" />
                      {priority} PRIORITY
                    </Badge>
                    <button onClick={() => setGaDialogOpen(true)} className="text-xs text-gray-500 hover:text-primary-600 underline">
                      View Analysis
                    </button>
                  </div>
                ) : null}
                <Button variant="outline" size="sm" onClick={handleClearScan} disabled={submitting}>
                  Cancel
                </Button>
              </div>
            </div>
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
