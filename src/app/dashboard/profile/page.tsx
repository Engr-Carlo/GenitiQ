"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, Button, Input, Badge, LoadingSpinner } from "@/components/ui";
import { getInitials } from "@/lib/utils";
import {
  User, Mail, Shield, Building2, Briefcase, Hash,
  Lock, CheckCircle2, AlertTriangle, Save, Eye, EyeOff,
} from "lucide-react";

// ============================================================
// Profile Page — available to all roles
// ============================================================

interface ProfileData {
  id: string;
  accountId: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  position: string | null;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-danger-100 text-danger-700",
  INSPECTOR: "bg-primary-100 text-primary-700",
  OPERATOR: "bg-success-100 text-success-700",
};

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Details form
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users/me");
      const data = await res.json();
      if (data.data) {
        setProfile(data.data);
        setName(data.data.name || "");
        setDepartment(data.data.department || "");
        setPosition(data.data.position || "");
      }
    } catch (e) {
      console.error("Failed to fetch profile", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), department, position }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update profile");
        return;
      }
      setProfile(prev => prev ? { ...prev, ...data.data } : prev);
      setSuccess("Profile updated successfully.");
      // Update NextAuth session name if changed
      await updateSession({ name: data.data.name });
    } catch {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All password fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to change password");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password changed successfully.");
    } catch {
      setError("Failed to change password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white">
            <User size={22} />
          </div>
          My Profile
        </h1>
        <p className="text-gray-500 mt-1 ml-13">Manage your personal details and password.</p>
      </div>

      {/* Feedback */}
      {success && (
        <div className="flex items-center gap-2 bg-success-50 border border-success-200 text-success-700 rounded-lg px-4 py-3 text-sm font-semibold">
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 text-danger-700 rounded-lg px-4 py-3 text-sm font-semibold">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Avatar + read-only info */}
      <Card>
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-2xl font-black flex-shrink-0">
            {getInitials(profile.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-gray-900 truncate">{profile.name}</h2>
            <p className="text-gray-500 text-sm truncate">{profile.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${ROLE_COLORS[profile.role] || "bg-gray-100 text-gray-600"}`}>
                {profile.role}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Hash size={11} />
                {profile.accountId}
              </span>
            </div>
          </div>
        </div>

        {/* Read-only fields */}
        <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Mail size={11} /> Email
            </p>
            <p className="text-sm text-gray-700 font-semibold">{profile.email}</p>
            <p className="text-xs text-gray-400 mt-0.5">Cannot be changed</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Shield size={11} /> Role
            </p>
            <p className="text-sm text-gray-700 font-semibold">{profile.role}</p>
            <p className="text-xs text-gray-400 mt-0.5">Assigned by admin</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Hash size={11} /> Account ID
            </p>
            <p className="text-sm font-mono text-gray-700 font-semibold">{profile.accountId}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Member Since</p>
            <p className="text-sm text-gray-700 font-semibold">
              {new Date(profile.createdAt).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>
      </Card>

      {/* Editable details */}
      <Card>
        <h3 className="text-base font-black uppercase tracking-wide text-gray-900 mb-4 flex items-center gap-2">
          <User size={18} className="text-primary-600" />
          Personal Details
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Full Name <span className="text-danger-500">*</span>
            </label>
            <Input
              value={name}
              onChange={e => { setName(e.target.value); setSuccess(null); setError(null); }}
              placeholder="Your full name"
              icon={<User size={16} />}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Department</label>
              <Input
                value={department}
                onChange={e => { setDepartment(e.target.value); setSuccess(null); setError(null); }}
                placeholder="e.g. Quality Assurance"
                icon={<Building2 size={16} />}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Position / Title</label>
              <Input
                value={position}
                onChange={e => { setPosition(e.target.value); setSuccess(null); setError(null); }}
                placeholder="e.g. Senior Inspector"
                icon={<Briefcase size={16} />}
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button
              variant="primary"
              icon={<Save size={16} />}
              onClick={handleSaveDetails}
              loading={saving}
              disabled={saving || !name.trim() || (name === profile.name && department === (profile.department || "") && position === (profile.position || ""))}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Card>

      {/* Change password */}
      <Card>
        <h3 className="text-base font-black uppercase tracking-wide text-gray-900 mb-4 flex items-center gap-2">
          <Lock size={18} className="text-warning-600" />
          Change Password
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Current Password</label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={e => { setCurrentPassword(e.target.value); setSuccess(null); setError(null); }}
                placeholder="Enter current password"
                icon={<Lock size={16} />}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowCurrent(v => !v)}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">New Password</label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setSuccess(null); setError(null); }}
                  placeholder="Min. 6 characters"
                  icon={<Lock size={16} />}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowNew(v => !v)}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Confirm New Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setSuccess(null); setError(null); }}
                placeholder="Repeat new password"
                icon={<Lock size={16} />}
              />
            </div>
          </div>
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-danger-600 font-semibold flex items-center gap-1">
              <AlertTriangle size={12} /> Passwords do not match
            </p>
          )}
          <div className="flex justify-end pt-1">
            <Button
              variant="warning"
              icon={<Lock size={16} />}
              onClick={handleChangePassword}
              loading={saving}
              disabled={saving || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            >
              Change Password
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
