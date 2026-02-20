"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, Badge, KPICard, LoadingSpinner } from "@/components/ui";
import { formatDuration } from "@/lib/utils";
import {
  DefectRateTrendChart,
  YieldTrendChart,
  DefectsBarChart,
  DistributionPieChart,
} from "@/components/charts";
import {
  TrendingDown,
  TrendingUp,
  BarChart3,
  Clock,
  Download,
  RotateCcw,
} from "lucide-react";

const periods = ["7d", "30d", "90d"] as const;

const PIE_COLORS: Record<string, string> = {
  VMM: "#1e40af",
  CMM: "#3b82f6",
};

interface KPIs {
  totalInspections: number;
  defectRate: string;
  yieldRate: string;
  queuedParts: number;
  activeMachines: number;
  totalMachines: number;
}

interface MachineUtilRow {
  id: string;
  name: string;
  type: string;
  inspectionCount: number;
}

interface TimingPerMachine {
  machineId: string;
  machineName: string;
  avgOperatorTime: number;
  avgInspectionTime: number;
  itemsCompleted: number;
}

interface TrendPoint {
  label: string;
  value: number;
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<(typeof periods)[number]>("7d");
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [machineUtilization, setMachineUtilization] = useState<MachineUtilRow[]>([]);
  const [perMachine, setPerMachine] = useState<TimingPerMachine[]>([]);
  const [defectTrend, setDefectTrend] = useState<TrendPoint[]>([]);
  const [yieldTrend, setYieldTrend] = useState<TrendPoint[]>([]);
  const [distribution, setDistribution] = useState<{ name: string; value: number; color: string }[]>([]);
  const [avgOperatorTime, setAvgOperatorTime] = useState<number>(0);
  const [avgInspectionTime, setAvgInspectionTime] = useState<number>(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const days = period === "90d" ? 90 : period === "30d" ? 30 : 7;

      const [analyticsRes, timingRes, inspectionsRes] = await Promise.all([
        fetch(`/api/analytics?period=${period}`),
        fetch(`/api/analytics/timing?days=${days}`),
        fetch(`/api/inspections?limit=500`),
      ]);

      const analyticsJson = await analyticsRes.json();
      const timingJson = await timingRes.json();
      const inspectionsJson = await inspectionsRes.json();

      const rawKpis = analyticsJson.data?.kpis;
      setKpis(rawKpis || null);
      setMachineUtilization(analyticsJson.data?.machineUtilization || []);

      const timingData = timingJson.data;
      setPerMachine(timingData?.perMachine || []);
      setAvgOperatorTime(timingData?.summary?.avgOperatorTime || 0);
      setAvgInspectionTime(timingData?.summary?.avgInspectionTime || 0);

      // Build trend charts from raw inspection records
      const allInspections: any[] = inspectionsJson.data || [];
      const now = new Date();
      const since = new Date();
      since.setDate(since.getDate() - days);
      const inPeriod = allInspections.filter(
        (i) => new Date(i.updatedAt) >= since && i.status === "COMPLETED"
      );

      // Generate daily buckets
      const buckets: Record<string, { accepted: number; total: number }> = {};
      for (let d = 0; d < days; d++) {
        const dt = new Date(since);
        dt.setDate(dt.getDate() + d);
        const label =
          days <= 7
            ? dt.toLocaleDateString([], { weekday: "short" })
            : days <= 30
            ? dt.toLocaleDateString([], { month: "short", day: "numeric" })
            : `W${Math.ceil((d + 1) / 7)}`;
        const key = dt.toISOString().slice(0, 10);
        buckets[key] = { accepted: 0, total: 0 };
      }
      inPeriod.forEach((i) => {
        const key = new Date(i.updatedAt).toISOString().slice(0, 10);
        if (buckets[key]) {
          buckets[key].total++;
          if (i.result === "ACCEPTED") buckets[key].accepted++;
        }
      });

      const allDates = Object.keys(buckets).sort();
      // For 90d, compress into weekly buckets
      if (days === 90) {
        const weeklyMap: Record<string, { accepted: number; total: number }> = {};
        allDates.forEach((dateKey, idx) => {
          const weekLabel = `W${Math.ceil((idx + 1) / 7)}`;
          if (!weeklyMap[weekLabel]) weeklyMap[weekLabel] = { accepted: 0, total: 0 };
          weeklyMap[weekLabel].accepted += buckets[dateKey].accepted;
          weeklyMap[weekLabel].total += buckets[dateKey].total;
        });
        const weekKeys = Object.keys(weeklyMap);
        setDefectTrend(
          weekKeys.map((wk) => ({
            label: wk,
            value:
              weeklyMap[wk].total > 0
                ? Math.round(((weeklyMap[wk].total - weeklyMap[wk].accepted) / weeklyMap[wk].total) * 1000) / 10
                : 0,
          }))
        );
        setYieldTrend(
          weekKeys.map((wk) => ({
            label: wk,
            value:
              weeklyMap[wk].total > 0
                ? Math.round((weeklyMap[wk].accepted / weeklyMap[wk].total) * 1000) / 10
                : 100,
          }))
        );
      } else {
        setDefectTrend(
          allDates.map((dateKey) => {
            const b = buckets[dateKey];
            const label =
              days <= 7
                ? new Date(dateKey).toLocaleDateString([], { weekday: "short" })
                : new Date(dateKey).toLocaleDateString([], { month: "short", day: "numeric" });
            return {
              label,
              value: b.total > 0 ? Math.round(((b.total - b.accepted) / b.total) * 1000) / 10 : 0,
            };
          })
        );
        setYieldTrend(
          allDates.map((dateKey) => {
            const b = buckets[dateKey];
            const label =
              days <= 7
                ? new Date(dateKey).toLocaleDateString([], { weekday: "short" })
                : new Date(dateKey).toLocaleDateString([], { month: "short", day: "numeric" });
            return {
              label,
              value: b.total > 0 ? Math.round((b.accepted / b.total) * 1000) / 10 : 100,
            };
          })
        );
      }

      // Distribution by machine type from machineUtilization
      const typeMap: Record<string, number> = {};
      (analyticsJson.data?.machineUtilization || []).forEach((m: MachineUtilRow) => {
        typeMap[m.type] = (typeMap[m.type] || 0) + m.inspectionCount;
      });
      const total = Object.values(typeMap).reduce((a: number, b: number) => a + b, 0);
      setDistribution(
        Object.entries(typeMap).map(([type, count]) => ({
          name: type,
          value: total > 0 ? Math.round((count / total) * 100) : 0,
          color: PIE_COLORS[type] || "#6b7280",
        }))
      );
    } catch (e) {
      console.error("Analytics fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Merge machine utilization with per-machine timing
  const machineRows = machineUtilization.map((m) => {
    const timing = perMachine.find((pm) => pm.machineName === m.name) || null;
    return {
      ...m,
      avgOperatorTime: timing?.avgOperatorTime ?? null,
      avgInspectionTime: timing?.avgInspectionTime ?? null,
    };
  });

  // Sort by inspection count descending
  machineRows.sort((a, b) => b.inspectionCount - a.inspectionCount);

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
              <BarChart3 size={22} />
            </div>
            Analytics
          </h1>
          <p className="text-gray-500 mt-1 ml-13">Quality performance metrics and inspection analytics.</p>
        </div>
        <div className="flex items-center gap-2">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                period === p
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
            </button>
          ))}
          <button
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            onClick={fetchData}
            title="Refresh"
          >
            <RotateCcw size={18} className="text-gray-500" />
          </button>
          <button className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 ml-1">
            <Download size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Inspections"
          value={String(kpis?.totalInspections ?? 0)}
          icon={<BarChart3 size={24} />}
        />
        <KPICard
          title="Defect Rate"
          value={kpis?.defectRate ?? "0.0%"}
          icon={<TrendingDown size={24} />}
        />
        <KPICard
          title="Overall Yield"
          value={kpis?.yieldRate ?? "0.0%"}
          icon={<TrendingUp size={24} />}
          variant="highlight"
        />
        <KPICard
          title="Avg Operator Time"
          value={avgOperatorTime > 0 ? formatDuration(avgOperatorTime) : "—"}
          icon={<Clock size={24} />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DefectRateTrendChart data={defectTrend} title="Defect Rate Trend (%)" height={260} />
        <YieldTrendChart data={yieldTrend} title="Yield Trend (%)" height={260} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DefectsBarChart
          data={distribution.map((d) => ({ label: d.name, value: d.value }))}
          title="Inspections by Machine Type (%)"
          height={260}
        />
        <DistributionPieChart data={distribution} title="Inspection Distribution" height={260} />
      </div>

      {/* Machine-level metrics */}
      <Card>
        <div className="p-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-500 mb-4">Machine Performance</h2>
          {machineRows.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No machine data available for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-3 font-bold text-gray-500 text-xs uppercase">Machine</th>
                    <th className="text-left py-3 px-3 font-bold text-gray-500 text-xs uppercase">Type</th>
                    <th className="text-left py-3 px-3 font-bold text-gray-500 text-xs uppercase">Inspections</th>
                    <th className="text-left py-3 px-3 font-bold text-gray-500 text-xs uppercase">Avg Op. Time</th>
                    <th className="text-left py-3 px-3 font-bold text-gray-500 text-xs uppercase">Avg QA Time</th>
                    <th className="text-left py-3 px-3 font-bold text-gray-500 text-xs uppercase">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {machineRows.map((m) => {
                    const totalInspections = machineRows.reduce((s, r) => s + r.inspectionCount, 0);
                    const share = totalInspections > 0
                      ? Math.round((m.inspectionCount / totalInspections) * 100)
                      : 0;
                    return (
                      <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-3 font-bold">{m.name}</td>
                        <td className="py-3 px-3">
                          <Badge variant={m.type === "VMM" ? "info" : "gray"}>{m.type}</Badge>
                        </td>
                        <td className="py-3 px-3">{m.inspectionCount}</td>
                        <td className="py-3 px-3">
                          {m.avgOperatorTime != null ? formatDuration(m.avgOperatorTime) : "—"}
                        </td>
                        <td className="py-3 px-3">
                          {m.avgInspectionTime != null ? formatDuration(m.avgInspectionTime) : "—"}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary-500 rounded-full"
                                style={{ width: `${share}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold">{share}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
