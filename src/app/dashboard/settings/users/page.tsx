"use client";

import React, { useState } from "react";
import { DataTable, Badge } from "@/components/ui";

// ============================================================
// Mock Data
// ============================================================

interface UserAccount {
  acctNo: string;
  name: string;
  email: string;
  department: string;
  position: string;
  levelOfAccess: string;
}

const mockUsers: UserAccount[] = [
  {
    acctNo: "CH001",
    name: "A. Dela Cruz",
    email: "ADC02@email.com",
    department: "QC",
    position: "Inspector",
    levelOfAccess: "User",
  },
  {
    acctNo: "CH002",
    name: "J. Santos",
    email: "JS11@email.com",
    department: "QC",
    position: "Manager",
    levelOfAccess: "Admin",
  },
  { acctNo: "CH003", name: "", email: "", department: "", position: "", levelOfAccess: "" },
  { acctNo: "CH004", name: "", email: "", department: "", position: "", levelOfAccess: "" },
  { acctNo: "CH005", name: "", email: "", department: "", position: "", levelOfAccess: "" },
  { acctNo: "CH006", name: "", email: "", department: "", position: "", levelOfAccess: "" },
  { acctNo: "CH007", name: "", email: "", department: "", position: "", levelOfAccess: "" },
];

// ============================================================
// User Accounts Page
// ============================================================

export default function UserAccountsPage() {
  const [users, setUsers] = useState<UserAccount[]>(mockUsers);

  const _handleRoleChange = (acctNo: string, newRole: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.acctNo === acctNo ? { ...u, levelOfAccess: newRole } : u))
    );
  };

  const columns = [
    {
      key: "acctNo",
      header: "Acct. No.",
      className: "font-bold w-20",
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
    },
    {
      key: "position",
      header: "Position",
      className: "min-w-[120px]",
    },
    {
      key: "levelOfAccess",
      header: "Level Of Access",
      className: "w-32",
      render: (item: UserAccount) => {
        if (!item.name) return (
          <select className="select-field text-xs py-1 px-2">
            <option value="">-</option>
            <option value="User">User</option>
            <option value="Admin">Admin</option>
          </select>
        );
        return (
          <Badge variant={item.levelOfAccess === "Admin" ? "success" : item.levelOfAccess === "User" ? "danger" : "gray"}>
            {item.levelOfAccess || "-"}
          </Badge>
        );
      },
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
