"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { getRoleLabel, getDashboardPath } from "@/lib/rbac";
import { UserRole } from "@/types";
import {
  Home,
  Settings,
  BarChart3,
  ClipboardCheck,
  Shield,
  Users,
  FileText,
  Monitor,
  ChevronDown,
  LogOut,
  User,
  Menu,
  X,
  Cpu,
  ListChecks,
} from "lucide-react";

// ============================================================
// Navigation Config
// ============================================================

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
  children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Home",
    href: "/dashboard/admin",
    icon: <Home size={20} />,
    roles: [UserRole.ADMIN],
  },
  {
    label: "Home",
    href: "/dashboard/inspector",
    icon: <Home size={20} />,
    roles: [UserRole.INSPECTOR],
  },
  {
    label: "Home",
    href: "/dashboard/operator",
    icon: <Home size={20} />,
    roles: [UserRole.OPERATOR],
  },
  {
    label: "Home",
    href: "/dashboard/qa",
    icon: <Home size={20} />,
    roles: [UserRole.QA_QC],
  },
  {
    label: "Queue Management",
    href: "/dashboard/queue",
    icon: <ListChecks size={20} />,
    roles: [UserRole.INSPECTOR, UserRole.OPERATOR, UserRole.QA_QC, UserRole.ADMIN],
  },
  {
    label: "Inspections",
    href: "/dashboard/inspections",
    icon: <ClipboardCheck size={20} />,
    roles: [UserRole.INSPECTOR, UserRole.QA_QC],
  },
  {
    label: "Machines",
    href: "/dashboard/machines",
    icon: <Cpu size={20} />,
    roles: [UserRole.OPERATOR, UserRole.ADMIN],
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: <BarChart3 size={20} />,
    roles: [UserRole.QA_QC, UserRole.ADMIN],
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: <Settings size={20} />,
    roles: [UserRole.ADMIN],
    children: [
      {
        label: "Manage Access",
        href: "/dashboard/settings/access",
        icon: <Shield size={18} />,
        roles: [UserRole.ADMIN],
      },
      {
        label: "User Accounts",
        href: "/dashboard/settings/users",
        icon: <Users size={18} />,
        roles: [UserRole.ADMIN],
      },
      {
        label: "Audit Logs",
        href: "/dashboard/settings/audit-logs",
        icon: <FileText size={18} />,
        roles: [UserRole.ADMIN],
      },
      {
        label: "Machine Reports",
        href: "/dashboard/settings/machine-reports",
        icon: <Monitor size={18} />,
        roles: [UserRole.ADMIN],
      },
    ],
  },
];

// ============================================================
// Header
// ============================================================

interface HeaderProps {
  user: {
    name: string;
    role: string;
    email: string;
  };
  onMenuToggle?: () => void;
}

export function Header({ user, onMenuToggle }: HeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const role = user.role as UserRole;
  const roleLabel = getRoleLabel(role);

  return (
    <header className="gradient-header text-white shadow-lg sticky top-0 z-40">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Menu size={22} />
          </button>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-widest text-white/70">
              Quality Assurance / Quality Control
            </h1>
            <h2 className="text-xl font-black uppercase tracking-wide">{roleLabel}</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={getDashboardPath(role)}
            className="px-4 py-2 text-sm font-bold uppercase tracking-wider hover:bg-white/10 rounded-lg transition-colors"
          >
            Home
          </Link>

          {role === UserRole.ADMIN && (
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <Settings size={22} />
              </button>
              {showSettings && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-fade-in z-50">
                  <Link
                    href="/dashboard/settings/access"
                    className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium"
                    onClick={() => setShowSettings(false)}
                  >
                    Manage Access
                  </Link>
                  <Link
                    href="/dashboard/settings/users"
                    className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium"
                    onClick={() => setShowSettings(false)}
                  >
                    User Accounts
                  </Link>
                  <Link
                    href="/dashboard/settings/audit-logs"
                    className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium"
                    onClick={() => setShowSettings(false)}
                  >
                    Audit Logs
                  </Link>
                  <Link
                    href="/dashboard/settings/machine-reports"
                    className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium"
                    onClick={() => setShowSettings(false)}
                  >
                    Machine Reports
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
                <User size={20} />
              </div>
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-3 animate-fade-in z-50">
                <div className="px-4 pb-3 border-b border-gray-100">
                  <p className="font-bold text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                  <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
                    {roleLabel}
                  </span>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger-600 hover:bg-danger-50 font-medium mt-1"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ============================================================
// Sidebar
// ============================================================

interface SidebarProps {
  user: {
    role: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const role = user.role as UserRole;
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const filteredItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const toggleExpanded = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-64 gradient-bg z-50 transform transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 lg:hidden">
          <span className="text-white font-bold">Navigation</span>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={22} />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1 overflow-y-auto h-[calc(100vh-80px)]">
          {filteredItems.map((item) => (
            <div key={item.label + item.href}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleExpanded(item.label)}
                    className={cn(
                      "w-full sidebar-link",
                      isActive(item.href) ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {item.icon}
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      size={16}
                      className={cn(
                        "transition-transform",
                        expandedItems.includes(item.label) && "rotate-180"
                      )}
                    />
                  </button>
                  {expandedItems.includes(item.label) && (
                    <div className="pl-4 mt-1 space-y-1">
                      {item.children
                        .filter((child) => child.roles.includes(role))
                        .map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "sidebar-link text-xs",
                              isActive(child.href) ? "bg-white/20 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
                            )}
                            onClick={onClose}
                          >
                            {child.icon}
                            {child.label}
                          </Link>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "sidebar-link",
                    isActive(item.href) ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                  onClick={onClose}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

// ============================================================
// Settings Sidebar (for admin settings pages)
// ============================================================

const SETTINGS_ITEMS = [
  { label: "Manage Access", href: "/dashboard/settings/access", icon: <Shield size={18} /> },
  { label: "User Accounts", href: "/dashboard/settings/users", icon: <Users size={18} /> },
  { label: "Audit Logs", href: "/dashboard/settings/audit-logs", icon: <FileText size={18} /> },
  { label: "Machine Reports", href: "/dashboard/settings/machine-reports", icon: <Monitor size={18} /> },
];

export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0">
      <nav className="space-y-1">
        {SETTINGS_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold uppercase tracking-wide transition-all",
                active
                  ? "bg-primary-800 text-white shadow-md"
                  : "text-primary-900 hover:bg-primary-50"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
