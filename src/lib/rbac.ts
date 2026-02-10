import { UserRole } from "@/types";

// ============================================================
// Permission Definitions
// ============================================================

export const PERMISSIONS = {
  // Inspection
  PERFORM_INSPECTION: [UserRole.INSPECTOR],
  VIEW_INSPECTION_QUEUE: [UserRole.INSPECTOR, UserRole.QA_QC, UserRole.ADMIN],
  OVERRIDE_INSPECTION: [UserRole.QA_QC],

  // Machine
  OPERATE_MACHINE: [UserRole.OPERATOR, UserRole.ADMIN],
  VIEW_MACHINE_STATUS: [UserRole.OPERATOR, UserRole.INSPECTOR, UserRole.QA_QC, UserRole.ADMIN],
  TRIGGER_SHUTDOWN: [UserRole.INSPECTOR, UserRole.OPERATOR, UserRole.QA_QC, UserRole.ADMIN],

  // Queue
  VIEW_QUEUE: [UserRole.INSPECTOR, UserRole.OPERATOR, UserRole.QA_QC, UserRole.ADMIN],
  REGENERATE_QUEUE: [UserRole.ADMIN, UserRole.QA_QC],

  // Analytics
  VIEW_QUALITY_ANALYTICS: [UserRole.QA_QC, UserRole.ADMIN],
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
  "/dashboard/qa": [UserRole.QA_QC],
  "/dashboard/queue": [UserRole.INSPECTOR, UserRole.OPERATOR, UserRole.QA_QC, UserRole.ADMIN],
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
  [UserRole.INSPECTOR]: "Inspector",
  [UserRole.OPERATOR]: "Machine Operator",
  [UserRole.QA_QC]: "QA/QC",
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
    case UserRole.QA_QC:
      return "/dashboard/qa";
    default:
      return "/dashboard";
  }
}
