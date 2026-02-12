 "use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { DataTable, Badge, LoadingSpinner } from "@/components/ui";
import {
  DefectRateTrendChart,
  YieldTrendChart,
  DefectsBarChart,
  DistributionPieChart,
  MiniStat,
  BigYieldDisplay,
} from "@/components/charts";


// ============================================================
// Mock Data (will be replaced with API calls)
// ============================================================

const mockKPIs = {
  defectRate: "2.0 %",
  queueRate: "16.2 %",
  overallYield: "90.6 %",
  scrapRate: "0.9 %",
  completeYield: "80.9 %",
};

const defectRateTrend = [
  { label: "Incoming", value: 2.0 },
  { label: "In-Process", value: 1.1 },
  { label: "Final", value: 0.2 },
];

const yieldTrend = [
  { label: "Sun", value: 0.75 },
  { label: "Mon", value: 0.78 },
  { label: "Tue", value: 0.76 },
  { label: "Wed", value: 0.78 },
  { label: "Thu", value: 0.80 },
  { label: "Fri", value: 0.82 },
  { label: "Sat", value: 0.80 },
  { label: "Sun", value: 0.83 },
  { label: "Mon", value: 0.85 },
  { label: "Tue", value: 0.87 },
];

const defectsByInspection = [
  { label: "Incoming", value: 18 },
  { label: "In-Process", value: 12 },
  { label: "Final", value: 5 },
];

const distributionData = [
  { name: "Passed", value: 75, color: "#1e40af" },
  { name: "Failed", value: 25, color: "#60a5fa" },
];

const inspectionResults = [
  {
    partNumber: "PN1001",
    status: "REJECTED",
    result: "FAIL",
    machineType: "VMM",
    inspector: "J. Dela Cruz",
    action: "REVIEW",
    queueTime: "19 Min.",
  },
  {
    partNumber: "PN1002",
    status: "ACCEPTED",
    result: "PASS",
    machineType: "CMM",
    inspector: "A. Santos",
    action: "VIEW",
    queueTime: "35 Min.",
  },
  {
    partNumber: "PN1003",
    status: "ACCEPTED",
    result: "PASS",
    machineType: "VMM",
    inspector: "V. De Jose",
    action: "VIEW",
    queueTime: "33 Min",
  },
];

// ============================================================
// Admin Dashboard Page
// ============================================================

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  const columns = [
    {
      key: "partNumber",
      header: "Part No.",
      className: "font-bold",
    },
    {
      key: "status",
      header: "Status",
      render: (item: (typeof inspectionResults)[0]) => (
        <Badge variant={item.status === "ACCEPTED" ? "success" : "danger"}>
          {item.status}
        </Badge>
      ),
    },
    {
      key: "result",
      header: "Result",
      render: (item: (typeof inspectionResults)[0]) => (
        <span className={item.result === "PASS" ? "text-success-600 font-bold" : "text-danger-600 font-bold"}>
          {item.result}
        </span>
      ),
    },
    { key: "machineType", header: "Machine Type" },
    { key: "inspector", header: "Inspector" },
    {
      key: "action",
      header: "Action",
      render: (item: (typeof inspectionResults)[0]) => (
        <button className="text-primary-700 font-bold hover:text-primary-900 underline text-xs uppercase">
          {item.action}
        </button>
      ),
    },
    { key: "queueTime", header: "Queue Time" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MiniStat title="Defect Rate (%)" value={mockKPIs.defectRate} />
        <MiniStat title="Queue Rate (%)" value={mockKPIs.queueRate} />
        <BigYieldDisplay value={mockKPIs.overallYield} />
        <MiniStat title="Scrap Rate (%)" value={mockKPIs.scrapRate} />
        <MiniStat title="Complete Yield (%)" value={mockKPIs.completeYield} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DefectRateTrendChart data={defectRateTrend} height={220} />
        <YieldTrendChart data={yieldTrend} height={220} />
        <div className="grid grid-rows-2 gap-4">
          <DefectsBarChart data={defectsByInspection} height={100} />
          <DistributionPieChart data={distributionData} height={100} />
        </div>
      </div>

      {/* Inspection Results Table */}
      <div>
        <h2 className="text-lg font-black uppercase tracking-wide text-gray-900 mb-3 underline underline-offset-4 decoration-2">
          Inspection Results
        </h2>
        <DataTable columns={columns} data={inspectionResults} />
      </div>
    </div>
  );
}
