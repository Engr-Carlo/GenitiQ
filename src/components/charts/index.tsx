"use client";

import React from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

// Shared tooltip style
const tooltipStyle = {
  backgroundColor: "rgba(255,255,255,0.96)",
  border: "none",
  borderRadius: "10px",
  boxShadow: "0 8px 24px -4px rgba(0,0,0,0.12), 0 2px 8px -2px rgba(0,0,0,0.06)",
  fontSize: "12px",
  fontWeight: 600,
  padding: "8px 14px",
};

// ============================================================
// Defect Rate Trend Chart
// ============================================================

interface TrendPoint {
  label: string;
  value: number;
}

interface DefectRateTrendProps {
  data: TrendPoint[];
  title?: string;
  color?: string;
  height?: number;
}

export function DefectRateTrendChart({ data, title = "Defect Rate Trend (%)", color = "#1e40af", height = 250 }: DefectRateTrendProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 mb-4 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="defectGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill="url(#defectGrad)"
            dot={{ fill: "white", stroke: color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: color, stroke: "white", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// Yield Trend Chart
// ============================================================

export function YieldTrendChart({ data, title = "Yield Trend (%)", height = 250 }: DefectRateTrendProps) {
  const color = "#059669";
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 mb-4 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill="url(#yieldGrad)"
            dot={{ fill: "white", stroke: color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: color, stroke: "white", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// Defects By Inspection Bar Chart
// ============================================================

interface DefectsBarChartProps {
  data: { label: string; value: number }[];
  title?: string;
  height?: number;
}

export function DefectsBarChart({ data, title = "Defects by Inspection", height = 250 }: DefectsBarChartProps) {
  const barColors = ["#1e3a5f", "#1e40af", "#3b82f6", "#60a5fa", "#93c5fd"];
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 mb-4 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(30,64,175,0.04)" }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={36}>
            {data.map((_, index) => (
              <Cell key={index} fill={barColors[index % barColors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// Distribution Pie Chart
// ============================================================

interface PieChartDataPoint {
  name: string;
  value: number;
  color: string;
}

interface DistributionPieChartProps {
  data: PieChartDataPoint[];
  title?: string;
  height?: number;
}

export function DistributionPieChart({ data, title, height = 250 }: DistributionPieChartProps) {
  // Dynamic radius based on container height to prevent overflow
  const outerRadius = Math.min(Math.floor(height * 0.35), 80);
  const innerRadius = Math.floor(outerRadius * 0.5);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col items-center overflow-hidden">
      {title && <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 mb-2 text-center">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={2}
            stroke="white"
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            height={24}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "11px", fontWeight: 600 }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [value, "Parts"]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// Mini Stat Card
// ============================================================

interface MiniStatProps {
  title: string;
  value: string;
  subtitle?: string;
  className?: string;
}

export function MiniStat({ title, value, subtitle, className }: MiniStatProps) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 shadow-sm p-5", className)}>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-black text-gray-900">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}

// ============================================================
// Big Yield Display
// ============================================================

interface BigYieldProps {
  value: string;
  label?: string;
}

export function BigYieldDisplay({ value, label = "Overall Yield (%)" }: BigYieldProps) {
  return (
    <div className="bg-gradient-to-br from-primary-50 via-white to-primary-50 rounded-xl border-2 border-primary-200 shadow-sm p-6 flex flex-col items-center justify-center">
      <p className="text-xs font-bold uppercase tracking-wider text-primary-600">{label}</p>
      <p className="mt-2 text-5xl font-black text-primary-800">{value}</p>
    </div>
  );
}
