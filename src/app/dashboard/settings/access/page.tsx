"use client";

import React, { useState } from "react";
import { Button, Card, Modal, Input, Select, Badge } from "@/components/ui";
import { Plus, Shield, Mail, User, Key } from "lucide-react";

// ============================================================
// Mock Data
// ============================================================

interface Admin {
  id: string;
  name: string;
  email: string;
  levelOfAccess: string;
  permissions: string[];
}

const mockAdmins: Admin[] = [
  {
    id: "1",
    name: "Engr. Juan Dela Cruz",
    email: "jdc@company.xyz",
    levelOfAccess: "Super Admin",
    permissions: ["Full Access", "System Config", "User Management"],
  },
  {
    id: "2",
    name: "Maria Santos",
    email: "ms@company.xyz",
    levelOfAccess: "Admin",
    permissions: ["User Management", "Reports"],
  },
];

// ============================================================
// Manage Access Page
// ============================================================

export default function ManageAccessPage() {
  const [admins, setAdmins] = useState<Admin[]>(mockAdmins);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    accountId: "",
    levelOfAccess: "",
    permissions: "",
  });

  const handleAddAdmin = () => {
    if (!formData.email || !formData.accountId) return;

    const newAdmin: Admin = {
      id: String(admins.length + 1),
      name: formData.accountId,
      email: formData.email,
      levelOfAccess: formData.levelOfAccess || "Admin",
      permissions: formData.permissions ? formData.permissions.split(",").map((p) => p.trim()) : ["View"],
    };

    setAdmins([...admins, newAdmin]);
    setShowAddModal(false);
    setFormData({ email: "", accountId: "", levelOfAccess: "", permissions: "" });
  };

  return (
    <div>
      <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 mb-6">
        Roles and Responsibilities
      </h1>

      {/* Add Admin Button */}
      <div className="mb-8">
        <Button
          variant="outline"
          size="lg"
          icon={<Plus size={20} />}
          onClick={() => setShowAddModal(true)}
          className="font-black uppercase tracking-wider"
        >
          Add Admin
        </Button>
      </div>

      {/* Admins List */}
      <div className="space-y-6">
        <h2 className="text-xl font-black text-gray-900 uppercase">Admins</h2>

        {admins.map((admin, idx) => (
          <Card key={admin.id} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-800">Admin {idx + 1}</h3>
                <div className="mt-2 space-y-1.5 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-gray-400" />
                    <span className="font-medium">{admin.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-gray-400" />
                    <span>{admin.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Key size={14} className="text-gray-400" />
                    <span>Level of Access: <strong>{admin.levelOfAccess}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Shield size={14} className="text-gray-400" />
                    <span>Permissions:</span>
                    {admin.permissions.map((perm) => (
                      <Badge key={perm} variant="info">{perm}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-danger-600 hover:text-danger-700">
                Remove
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Admin Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Admin" size="md">
        <div className="space-y-4">
          <Input
            placeholder="Work Email Address"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            icon={<Mail size={16} />}
          />
          <Input
            placeholder="Account ID"
            value={formData.accountId}
            onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
            icon={<User size={16} />}
          />
          <Input
            placeholder="Level of Access"
            value={formData.levelOfAccess}
            onChange={(e) => setFormData({ ...formData, levelOfAccess: e.target.value })}
            icon={<Key size={16} />}
          />
          <Select
            placeholder="Permissions"
            options={[
              { value: "Full Access", label: "Full Access" },
              { value: "User Management", label: "User Management" },
              { value: "Reports", label: "Reports" },
              { value: "View Only", label: "View Only" },
            ]}
            value={formData.permissions}
            onChange={(e) => setFormData({ ...formData, permissions: e.target.value })}
          />
          <Button
            variant="primary"
            size="lg"
            className="w-full font-bold uppercase tracking-wider"
            onClick={handleAddAdmin}
          >
            Add Account as Admin
          </Button>
        </div>
      </Modal>
    </div>
  );
}
