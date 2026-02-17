"use client";

import React, { useState, useEffect } from "react";
import { DataTable, Badge, LoadingSpinner } from "@/components/ui";

// ============================================================
// Types
// ============================================================

interface UserAccount {
  id: string;
  accountId: string;
  name: string;
  email: string;
  department: string | null;
  position: string | null;
  role: string;
  isActive: boolean;
}

// ============================================================
// User Accounts Page
// ============================================================

export default function UserAccountsPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users?limit=100");
      const data = await response.json();
      setUsers(data.data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
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

  const columns = [
    {
      key: "accountId",
      header: "Acct. No.",
      className: "font-bold w-32",
    },
    {
      key: "name",
      header: "Name",
      className: "min-w-[150px]",
    },
    {
      key: "email",
      header: "Email",
      className: "min-w-[180px]",
    },
    {
      key: "department",
      header: "Department",
      className: "w-28",
      render: (item: UserAccount) => item.department || "-",
    },
    {
      key: "position",
      header: "Position",
      className: "min-w-[120px]",
      render: (item: UserAccount) => item.position || "-",
    },
    {
      key: "role",
      header: "Role",
      className: "w-32",
      render: (item: UserAccount) => (
        <Badge variant={
          item.role === "ADMIN" ? "success" : 
          item.role === "INSPECTOR" ? "info" : 
          item.role === "OPERATOR" ? "warning" : 
          "gray"
        }>
          {item.role}
        </Badge>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      className: "w-24",
      render: (item: UserAccount) => (
        <Badge variant={item.isActive ? "success" : "danger"}>
          {item.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 mb-6">
        User Accounts
      </h1>
      <DataTable columns={columns} data={users} />
    </div>
  );
}
