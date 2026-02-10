"use client";

import React, { useState } from "react";
import { Card, Badge, KPICard } from "@/components/ui";
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
  Calendar,
  Download,
} from "lucide-react";

const periods = ["7d", "30d", "90d"] as const;

const mockDefectTrend = [
  { label: "Mon", value: 3.2 },
  { label: "Tue", value: 2.8 },
  { label: "Wed", value: 3.5 },
  { label: "Thu", value: 2.1 },
  { label: "Fri", value: 1.9 },
  { label: "Sat", value: 2.4 },
  { label: "Sun", value: 2.0 },
];

const mockYieldTrend = [
  { label: "Mon", value: 96.8 },
  { label: "Tue", value: 97.2 },
  { label: "Wed", value: 96.5 },
  { label: "Thu", value: 97.9 },
  { label: "Fri", value: 98.1 },
  { label: "Sat", value: 97.6 },
  { label: "Sun", value: 98.0 },
];

const mockDefectsByType = [
  { label: "Dimensional", value: 45 },
  { label: "Surface", value: 28 },
  { label: "Material", value: 15 },
  { label: "Assembly", value: 8 },
  { label: "Other", value: 4 },
];

const mockDistribution = [
  { name: "VMM", value: 62, color: "#1e40af" },
  { name: "CMM", value: 38, color: "#3b82f6" },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<(typeof periods)[number]>("7d");

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
          <button className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 ml-2">
            <Download size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Total Inspections" value="1,284" icon={<BarChart3 size={24} />} />
        <KPICard title="Defect Rate" value="2.4%" icon={<TrendingDown size={24} />} />
        <KPICard title="Overall Yield" value="97.6%" icon={<TrendingUp size={24} />} variant="highlight" />
        <KPICard title="Avg Queue Time" value="14 min" icon={<Calendar size={24} />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DefectRateTrendChart data={mockDefectTrend} title="Defect Rate Trend (%)" height={260} />
        <YieldTrendChart data={mockYieldTrend} title="Yield Trend (%)" height={260} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DefectsBarChart data={mockDefectsByType} title="Defects by Type" height={260} />
        <DistributionPieChart data={mockDistribution} title="Inspection Distribution" height={260} />
      </div>

      {/* Machine-level metrics */}
      <Card>
        <div className="p-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-500 mb-4">Machine Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-3 font-bold text-gray-500 text-xs uppercase">Machine</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-500 text-xs uppercase">Type</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-500 text-xs uppercase">Inspections</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-500 text-xs uppercase">Defect Rate</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-500 text-xs uppercase">Avg Cycle</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-500 text-xs uppercase">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "VMM-1", type: "VMM", inspections: 245, defectRate: "2.0%", cycle: "12 min", util: "87%" },
                  { name: "VMM-2", type: "VMM", inspections: 198, defectRate: "2.5%", cycle: "15 min", util: "72%" },
                  { name: "VMM-5", type: "VMM", inspections: 156, defectRate: "1.9%", cycle: "14 min", util: "65%" },
                  { name: "VMM-6", type: "VMM", inspections: 289, defectRate: "3.1%", cycle: "11 min", util: "91%" },
                  { name: "CMM-1", type: "CMM", inspections: 178, defectRate: "2.2%", cycle: "22 min", util: "78%" },
                  { name: "CMM-2", type: "CMM", inspections: 218, defectRate: "2.8%", cycle: "25 min", util: "82%" },
                ].map((m) => (
                  <tr key={m.name} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-3 font-bold">{m.name}</td>
                    <td className="py-3 px-3">
                      <Badge variant={m.type === "VMM" ? "info" : "gray"}>{m.type}</Badge>
                    </td>
                    <td className="py-3 px-3">{m.inspections}</td>
                    <td className="py-3 px-3">{m.defectRate}</td>
                    <td className="py-3 px-3">{m.cycle}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full"
                            style={{ width: m.util }}
                          />
                        </div>
                        <span className="text-xs font-bold">{m.util}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
