"use client";

import React, { useState, useEffect } from "react";
import { Button, Card, Modal, Input, Select, Badge, LoadingSpinner } from "@/components/ui";
import { Plus, Edit2, Mail, User, Key, Briefcase, Building2 } from "lucide-react";

// ============================================================
// Types
// ============================================================

interface UserAccount {
  id: string;
  accountId: string;
  name: string;
  email: string;
  role: "ADMIN" | "INSPECTOR" | "OPERATOR";
  department: string | null;
  position: string | null;
  isActive: boolean;
}

// ============================================================
// Manage Access Page
// ============================================================

export default function ManageAccessPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "OPERATOR" as "OPERATOR" | "INSPECTOR",
    department: "",
    position: "",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users?limit=100");
      const data = await res.json();
      if (res.ok) {
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: UserAccount) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        password: "",
        role: user.role === "ADMIN" ? "OPERATOR" : user.role,
        department: user.department || "",
        position: user.position || "",
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: "",
        email: "",
        password: "",
        role: "OPERATOR",
        department: "",
        position: "",
      });
    }
    setShowModal(true);
    setMessage(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "OPERATOR",
      department: "",
      position: "",
    });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.email) {
      setMessage({ type: "error", text: "Name and email are required" });
      return;
    }

    if (!editingUser && !formData.password) {
      setMessage({ type: "error", text: "Password is required for new users" });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      if (editingUser) {
        // Update existing user
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            role: formData.role,
            department: formData.department || null,
            position: formData.position || null,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setMessage({ type: "success", text: "User updated successfully" });
          fetchUsers();
          setTimeout(handleCloseModal, 1500);
        } else {
          setMessage({ type: "error", text: data.error || "Failed to update user" });
        }
      } else {
        // Create new user
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            role: formData.role,
            department: formData.department || null,
            position: formData.position || null,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setMessage({ type: "success", text: "User created successfully" });
          fetchUsers();
          setTimeout(handleCloseModal, 1500);
        } else {
          setMessage({ type: "error", text: data.error || "Failed to create user" });
        }
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (userId: string, userName: string) => {
    if (!confirm(`Permanently delete user ${userName}? This action cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchUsers();
      } else {
        alert("Failed to delete user");
      }
    } catch (error) {
      alert("Failed to delete user");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const admins = users.filter((u) => u.role === "ADMIN");
  const inspectors = users.filter((u) => u.role === "INSPECTOR");
  const operators = users.filter((u) => u.role === "OPERATOR");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 mb-2">
          Manage Access
        </h1>
        <p className="text-gray-500">Manage operator and inspector accounts. Only 1 admin is allowed.</p>
      </div>

      {/* Add User Button */}
      <div className="flex gap-3">
        <Button
          variant="primary"
          size="lg"
          icon={<Plus size={20} />}
          onClick={() => handleOpenModal()}
          className="font-black uppercase tracking-wider"
        >
          Add Operator/Inspector
        </Button>
      </div>

      {/* Admin Section (Read-only) */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-gray-900 uppercase flex items-center gap-2">
          <Key size={20} className="text-gray-600" />
          Admin (Read-Only)
        </h2>
        <Card className="bg-gray-50">
          <p className="text-sm text-gray-600 mb-4">
            There can only be 1 admin account. This account has full system access.
          </p>
          {admins.map((admin) => (
            <Card key={admin.id} className="bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant="success" className="mb-2">ADMIN</Badge>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-400" />
                      <span className="font-bold">{admin.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-gray-400" />
                      <span>{admin.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Key size={14} className="text-gray-400" />
                      <span>Account ID: {admin.accountId}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </Card>
      </div>

      {/* Inspectors Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-gray-900 uppercase flex items-center gap-2">
          <Briefcase size={20} className="text-gray-600" />
          Inspectors ({inspectors.length})
        </h2>
        <div className="grid gap-4">
          {inspectors.length === 0 ? (
            <Card className="p-6 text-center text-gray-500">
              <p>No inspectors yet. Add one using the button above.</p>
            </Card>
          ) : (
            inspectors.map((user) => (
              <Card key={user.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Badge variant="info" className="mb-2">INSPECTOR</Badge>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        <span className="font-bold">{user.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-gray-400" />
                        <span>{user.email}</span>
                      </div>
                      {user.department && (
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-gray-400" />
                          <span>{user.department}</span>
                        </div>
                      )}
                      {user.position && (
                        <div className="flex items-center gap-2">
                          <Briefcase size={14} className="text-gray-400" />
                          <span>{user.position}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Edit2 size={14} />}
                      onClick={() => handleOpenModal(user)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger-600 hover:text-danger-700"
                      onClick={() => handleDeactivate(user.id, user.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Operators Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-gray-900 uppercase flex items-center gap-2">
          <User size={20} className="text-gray-600" />
          Operators ({operators.length})
        </h2>
        <div className="grid gap-4">
          {operators.length === 0 ? (
            <Card className="p-6 text-center text-gray-500">
              <p>No operators yet. Add one using the button above.</p>
            </Card>
          ) : (
            operators.map((user) => (
              <Card key={user.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Badge variant="warning" className="mb-2">OPERATOR</Badge>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        <span className="font-bold">{user.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-gray-400" />
                        <span>{user.email}</span>
                      </div>
                      {user.department && (
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-gray-400" />
                          <span>{user.department}</span>
                        </div>
                      )}
                      {user.position && (
                        <div className="flex items-center gap-2">
                          <Briefcase size={14} className="text-gray-400" />
                          <span>{user.position}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Edit2 size={14} />}
                      onClick={() => handleOpenModal(user)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger-600 hover:text-danger-700"
                      onClick={() => handleDeactivate(user.id, user.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Add/Edit User Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingUser ? "Edit User" : "Add Operator/Inspector"}
        size="md"
      >
        <div className="space-y-4">
          {message && (
            <div
              className={`p-3 rounded-lg ${
                message.type === "success"
                  ? "bg-success-50 text-success-900 border border-success-200"
                  : "bg-danger-50 text-danger-900 border border-danger-200"
              }`}
            >
              {message.text}
            </div>
          )}

          <Input
            placeholder="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            icon={<User size={16} />}
          />

          <Input
            placeholder="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            icon={<Mail size={16} />}
            disabled={!!editingUser}
          />

          {!editingUser && (
            <Input
              placeholder="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              icon={<Key size={16} />}
            />
          )}

          <Select
            placeholder="Role"
            options={[
              { value: "OPERATOR", label: "Operator" },
              { value: "INSPECTOR", label: "Inspector" },
            ]}
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value as "OPERATOR" | "INSPECTOR" })}
          />

          <Input
            placeholder="Department (Optional)"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            icon={<Building2 size={16} />}
          />

          <Input
            placeholder="Position (Optional)"
            value={formData.position}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
            icon={<Briefcase size={16} />}
          />

          <Button
            variant="primary"
            size="lg"
            className="w-full font-bold uppercase tracking-wider"
            onClick={handleSubmit}
            loading={submitting}
            disabled={submitting}
          >
            {editingUser ? "Update User" : "Create User"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
