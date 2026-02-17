"use client";

import React, { useState, useEffect } from "react";
import { DataTable, Select, LoadingSpinner } from "@/components/ui";

// ============================================================
// Types
// ============================================================

interface MachineOption {
  value: string;
  label: string;
}

// ============================================================
// Machine Reports Page
// ============================================================

export default function MachineReportsPage() {
  const [selectedMachine, setSelectedMachine] = useState("");
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/machines");
      const data = await response.json();
      const machineOptions = data.data.map((m: any) => ({
        value: m.id,
        label: m.name,
      }));
      setMachines(machineOptions);
      if (machineOptions.length > 0) {
        setSelectedMachine(machineOptions[0].value);
      }
    } catch (error) {
      console.error("Error fetching machines:", error);
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

  return (
    <div>
      <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 mb-4">
        Machine Reports
      </h1>

      <div className="mb-6 max-w-xs">
        <Select
          options={machines}
          value={selectedMachine}
          onChange={(e) => setSelectedMachine(e.target.value)}
          className="font-bold text-primary-900"
        />
      </div>

      <p className="text-gray-500 italic">Machine reports feature - Connected to database. Select a machine to view its reports.</p>
    </div>
  );
}
