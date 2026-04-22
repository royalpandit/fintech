export type AppUserType = "super_admin" | "admin" | "advisor" | "user";

export type PermissionAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "moderate"
  | "export";

export type FeatureKey =
  | "dashboard"
  | "users"
  | "advisors"
  | "market_posts"
  | "community"
  | "reports"
  | "ai_compliance"
  | "analytics"
  | "payments"
  | "courses"
  | "notifications"
  | "audit_logs"
  | "settings"
  | "permissions";

export type PermissionMatrix = Record<AppUserType, Record<FeatureKey, PermissionAction[]>>;

export const FEATURES: Array<{ key: FeatureKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "users", label: "Users" },
  { key: "advisors", label: "Advisors" },
  { key: "market_posts", label: "Market Posts" },
  { key: "community", label: "Community" },
  { key: "reports", label: "Reports" },
  { key: "ai_compliance", label: "AI & Compliance" },
  { key: "analytics", label: "Analytics" },
  { key: "payments", label: "Payments" },
  { key: "courses", label: "Courses" },
  { key: "notifications", label: "Notifications" },
  { key: "audit_logs", label: "Audit Logs" },
  { key: "settings", label: "Settings" },
  { key: "permissions", label: "Permissions" },
];

export const ACTIONS: PermissionAction[] = [
  "view",
  "create",
  "update",
  "delete",
  "approve",
  "moderate",
  "export",
];

const ALL_ACTIONS: PermissionAction[] = [...ACTIONS];

function fullAccess(): Record<FeatureKey, PermissionAction[]> {
  return FEATURES.reduce(
    (acc, feature) => {
      acc[feature.key] = [...ALL_ACTIONS];
      return acc;
    },
    {} as Record<FeatureKey, PermissionAction[]>,
  );
}

export const DEFAULT_PERMISSION_MATRIX: PermissionMatrix = {
  super_admin: fullAccess(),
  admin: {
    dashboard: ["view"],
    users: ["view"],
    advisors: ["view", "approve", "moderate"],
    market_posts: ["view", "moderate", "approve"],
    community: ["view", "moderate"],
    reports: ["view", "update", "moderate"],
    ai_compliance: ["view"],
    analytics: ["view"],
    payments: [],
    courses: [],
    notifications: ["view"],
    audit_logs: ["view"],
    settings: [],
    permissions: [],
  },
  advisor: {
    dashboard: ["view"],
    users: [],
    advisors: ["view"],
    market_posts: ["view", "create", "update"],
    community: ["view", "create", "update"],
    reports: ["view"],
    ai_compliance: ["view"],
    analytics: ["view"],
    payments: ["view"],
    courses: ["view", "create", "update"],
    notifications: ["view"],
    audit_logs: [],
    settings: ["view", "update"],
    permissions: [],
  },
  user: {
    dashboard: ["view"],
    users: [],
    advisors: ["view"],
    market_posts: ["view"],
    community: ["view", "create", "update"],
    reports: ["create"],
    ai_compliance: [],
    analytics: ["view"],
    payments: ["view"],
    courses: ["view"],
    notifications: ["view"],
    audit_logs: [],
    settings: ["view", "update"],
    permissions: [],
  },
};

export function can(
  role: AppUserType,
  feature: FeatureKey,
  action: PermissionAction,
  matrix: PermissionMatrix = DEFAULT_PERMISSION_MATRIX,
): boolean {
  return matrix[role]?.[feature]?.includes(action) ?? false;
}

export function isAdminOrAbove(role: string): role is "admin" | "super_admin" {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdmin(role: string): role is "super_admin" {
  return role === "super_admin";
}
