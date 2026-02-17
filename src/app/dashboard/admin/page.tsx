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
// Admin Dashboard Page
// ============================================================

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    defectRate: "0%",
    yieldRate: "0%",
    totalInspections: 0,
    queuedParts: 0,
  });
  const [recentInspections, setRecentInspections] = useState<any[]>([]);

  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/analytics?period=7d");
      const data = await response.json();
      
      if (data.data) {
        setKpis({
          defectRate: data.data.kpis.defectRate,
          yieldRate: data.data.kpis.yieldRate,
          totalInspections: data.data.kpis.totalInspections,
          queuedParts: data.data.kpis.queuedParts,
        });
        setRecentInspections(data.data.recentInspections || []);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Mock chart data (these would come from analytics API in a full implementation)
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

  const columns = [
    {
      key: "partNumber",
      header: "Part No.",
      className: "font-bold",
      render: (item: any) => item.part?.partNumber || "-",
    },
    {
      key: "result",
      header: "Status",
      render: (item: any) => (
        <Badge variant={item.result === "ACCEPTED" ? "success" : "danger"}>
          {item.result}
        </Badge>
      ),
    },
    {
      key: "machineType",
      header: "Machine Type",
      render: (item: any) => item.machine?.type || "-",
    },
    { 
      key: "inspector", 
      header: "Inspector",
      render: (item: any) => item.inspector?.name || "-",
    },
    { 
      key: "createdAt", 
      header: "Date",
      render: (item: any) => new Date(item.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MiniStat title="Defect Rate" value={kpis.defectRate} />
        <MiniStat title="Queued Parts" value={String(kpis.queuedParts)} />
        <BigYieldDisplay value={kpis.yieldRate} />
        <MiniStat title="Total Inspections" value={String(kpis.totalInspections)} />
        <MiniStat title="Yield Rate" value={kpis.yieldRate} />
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
          Recent Inspection Results
        </h2>
        <DataTable columns={columns} data={recentInspections} />
      </div>
    </div>
  );
}
