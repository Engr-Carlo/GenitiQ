"use client";

import React from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

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
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              fontSize: "12px",
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            dot={{ fill: color, strokeWidth: 2, r: 5 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// Yield Trend Chart
// ============================================================

export function YieldTrendChart({ data, title = "Yield Trend (%)", height = 250 }: DefectRateTrendProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 mb-4 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              fontSize: "12px",
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#1e40af"
            strokeWidth={2.5}
            dot={{ fill: "#1e40af", strokeWidth: 2, r: 5 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
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
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 mb-4 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="value" fill="#1e40af" radius={[4, 4, 0, 0]} barSize={40}>
            {data.map((_, index) => (
              <Cell key={index} fill={index === 0 ? "#1e3a5f" : index === 1 ? "#1e40af" : "#3b82f6"} />
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
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col items-center">
      {title && <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 mb-2 text-center">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={0}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
          <Tooltip />
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
