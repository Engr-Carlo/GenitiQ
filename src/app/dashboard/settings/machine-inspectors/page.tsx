"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, Button, DataTable, Badge, LoadingSpinner } from "@/components/ui";
import { Settings, UserCheck, UserX, CheckCircle2, AlertCircle } from "lucide-react";

interface Inspector {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Machine {
  id: string;
  name: string;
  type: string;
  status: string;
  assignedInspector: Inspector | null;
}

export default function MachineInspectorAssignmentPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") redirect("/login");
    if (session?.user.role !== "ADMIN") redirect("/dashboard");
  }, [session, status]);

  useEffect(() => {
    if (session?.user.role === "ADMIN") {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch machines with assigned inspectors
      const machinesRes = await fetch("/api/admin/machines/assign-inspector");
      const machinesData = await machinesRes.json();
      
      // Fetch all inspectors
      const inspectorsRes = await fetch("/api/users?role=INSPECTOR");
      const inspectorsData = await inspectorsRes.json();
      
      if (machinesRes.ok) {
        setMachines(machinesData.data || []);
      }
      
      if (inspectorsRes.ok) {
        setInspectors(inspectorsData.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setMessage({ type: "error", text: "Failed to load data" });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (machineId: string, inspectorId: string | null) => {
    try {
      setAssigning(machineId);
      setMessage(null);
      
      const res = await fetch("/api/admin/machines/assign-inspector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId, inspectorId }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        await fetchData(); // Refresh data
      } else {
        setMessage({ type: "error", text: data.error || "Assignment failed" });
      }
    } catch (error) {
      console.error("Failed to assign inspector:", error);
      setMessage({ type: "error", text: "Assignment failed" });
    } finally {
      setAssigning(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  const columns = [
    {
      key: "name",
      header: "Machine",
      render: (machine: Machine) => (
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-gray-400" />
          <span className="font-bold">{machine.name}</span>
          <Badge variant={machine.type === "VMM" ? "info" : "warning"}>
            {machine.type}
          </Badge>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (machine: Machine) => {
        const statusColors: Record<string, "success" | "warning" | "danger" | "info"> = {
          ACTIVE: "success",
          IDLE: "info",
          MAINTENANCE: "warning",
          SHUTDOWN: "danger",
        };
        return <Badge variant={statusColors[machine.status] || "info"}>{machine.status}</Badge>;
      },
    },
    {
      key: "assignedInspector",
      header: "Assigned Inspector",
      render: (machine: Machine) => (
        <div className="flex items-center gap-2">
          {machine.assignedInspector ? (
            <>
              <UserCheck size={16} className="text-green-500" />
              <div className="text-sm">
                <p className="font-medium">{machine.assignedInspector.name}</p>
                <p className="text-gray-400 text-xs">{machine.assignedInspector.email}</p>
              </div>
            </>
          ) : (
            <>
              <UserX size={16} className="text-gray-400" />
              <span className="text-gray-400 text-sm italic">Not assigned</span>
            </>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (machine: Machine) => (
        <div className="flex items-center gap-2">
          <select
            value={machine.assignedInspector?.id || ""}
            onChange={(e) => handleAssign(machine.id, e.target.value || null)}
            disabled={assigning === machine.id}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">-- Unassign --</option>
            {inspectors.map((inspector) => (
              <option key={inspector.id} value={inspector.id}>
                {inspector.name} ({inspector.email})
              </option>
            ))}
          </select>
          
          {assigning === machine.id && (
            <div className="text-sm text-blue-500">Updating...</div>
          )}
        </div>
      ),
    },
  ];

  const assignedCount = machines.filter((m) => m.assignedInspector).length;
  const unassignedCount = machines.length - assignedCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Machine Inspector Assignment</h1>
          <p className="text-gray-500 mt-1">Assign inspectors to machines</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-md ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total Machines</div>
          <div className="text-2xl font-bold mt-1">{machines.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Assigned</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{assignedCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Unassigned</div>
          <div className="text-2xl font-bold mt-1 text-orange-600">{unassignedCount}</div>
        </Card>
      </div>

      {/* Machines Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Machines</h2>
          <DataTable columns={columns} data={machines} />
        </div>
      </Card>

      {/* Available Inspectors */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Available Inspectors</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {inspectors.map((inspector) => (
              <div
                key={inspector.id}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-md"
              >
                <UserCheck size={18} className="text-blue-500" />
                <div className="text-sm">
                  <p className="font-medium">{inspector.name}</p>
                  <p className="text-gray-400 text-xs">{inspector.email}</p>
                </div>
              </div>
            ))}
          </div>
          {inspectors.length === 0 && (
            <p className="text-gray-400 text-sm italic">No inspectors available</p>
          )}
        </div>
      </Card>
    </div>
  );
}
