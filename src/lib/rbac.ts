import { UserRole } from "@/types";

// ============================================================
// Permission Definitions
// ============================================================

export const PERMISSIONS = {
  // Inspection
  PERFORM_INSPECTION: [UserRole.INSPECTOR],
  VIEW_INSPECTION_QUEUE: [UserRole.INSPECTOR, UserRole.ADMIN],
  OVERRIDE_INSPECTION: [UserRole.INSPECTOR],

  // Machine
  OPERATE_MACHINE: [UserRole.OPERATOR, UserRole.ADMIN],
  VIEW_MACHINE_STATUS: [UserRole.OPERATOR, UserRole.INSPECTOR, UserRole.ADMIN],
  TRIGGER_SHUTDOWN: [UserRole.INSPECTOR, UserRole.OPERATOR, UserRole.ADMIN],

  // Queue
  VIEW_QUEUE: [UserRole.INSPECTOR, UserRole.OPERATOR, UserRole.ADMIN],
  REGENERATE_QUEUE: [UserRole.ADMIN, UserRole.INSPECTOR],

  // Analytics
  VIEW_QUALITY_ANALYTICS: [UserRole.INSPECTOR, UserRole.ADMIN],
  VIEW_PERSONAL_METRICS: [UserRole.INSPECTOR],

  // Admin
  MANAGE_USERS: [UserRole.ADMIN],
  CONFIGURE_GA: [UserRole.ADMIN],
  VIEW_AUDIT_LOGS: [UserRole.ADMIN],
  VIEW_MACHINE_REPORTS: [UserRole.ADMIN],
  GENERATE_REPORTS: [UserRole.ADMIN],
  MANAGE_ACCESS: [UserRole.ADMIN],
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ============================================================
// Helper Functions
// ============================================================

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowed: readonly UserRole[] = PERMISSIONS[permission];
  return allowed.includes(role);
}

export function getUserPermissions(role: UserRole): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((perm) => {
    const allowed: readonly UserRole[] = PERMISSIONS[perm];
    return allowed.includes(role);
  });
}

// ============================================================
// Route Access Control
// ============================================================

const ROUTE_ACCESS: Record<string, UserRole[]> = {
  "/dashboard/admin": [UserRole.ADMIN],
  "/dashboard/inspector": [UserRole.INSPECTOR],
  "/dashboard/operator": [UserRole.OPERATOR],
  "/dashboard/queue": [UserRole.INSPECTOR, UserRole.OPERATOR, UserRole.ADMIN],
  "/dashboard/settings": [UserRole.ADMIN],
};

export function canAccessRoute(role: UserRole, path: string): boolean {
  // Find matching route
  const matchingRoute = Object.keys(ROUTE_ACCESS).find((route) =>
    path.startsWith(route)
  );

  if (!matchingRoute) return true; // No restriction found
  return ROUTE_ACCESS[matchingRoute].includes(role);
}

// ============================================================
// Role Display Names
// ============================================================

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.INSPECTOR]: "Inspector/QC",
  [UserRole.OPERATOR]: "Machine Operator",
  [UserRole.ADMIN]: "Admin",
};

export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] || role;
}

// ============================================================
// Role-based Dashboard Redirect
// ============================================================

export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return "/dashboard/admin";
    case UserRole.INSPECTOR:
      return "/dashboard/inspector";
    case UserRole.OPERATOR:
      return "/dashboard/operator";
    default:
      return "/dashboard";
  }
}
