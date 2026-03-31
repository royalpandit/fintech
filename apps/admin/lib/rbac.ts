export type AppUserType = "advisor" | "user";

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
  | "settings";

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
];

export const ACTIONS: PermissionAction[] = ["view", "create", "update", "delete", "approve", "moderate", "export"];

export const DEFAULT_PERMISSION_MATRIX: PermissionMatrix = {
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
  },
};

