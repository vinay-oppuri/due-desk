export type MemberRole = "owner" | "accountant" | "ca" | "viewer";

export interface RoleDefinition {
  priority: number;
  label: string;
  isReadOnly: boolean;
  canManageMembers: boolean;
  canFile: boolean;
  canManageSettings: boolean;
}

export const ROLES: Record<MemberRole, RoleDefinition> = {
  owner: {
    priority: 4,
    label: "Owner",
    isReadOnly: false,
    canManageMembers: true,
    canFile: true,
    canManageSettings: true,
  },
  accountant: {
    priority: 3,
    label: "Accountant",
    isReadOnly: false,
    canManageMembers: false,
    canFile: true,
    canManageSettings: false,
  },
  ca: {
    priority: 2,
    label: "Chartered Accountant",
    isReadOnly: false,
    canManageMembers: false,
    canFile: true,
    canManageSettings: false,
  },
  viewer: {
    priority: 1,
    label: "Viewer",
    isReadOnly: true,
    canManageMembers: false,
    canFile: false,
    canManageSettings: false,
  },
};

/**
 * Checks if a user's role satisfies the required minimum role in the hierarchy:
 * owner (4) >= accountant (3) >= ca (2) >= viewer (1)
 */
export function hasMinimumRole(userRole: string, requiredRole: MemberRole): boolean {
  const current = ROLES[userRole as MemberRole];
  const required = ROLES[requiredRole];
  if (!current || !required) return false;
  return current.priority >= required.priority;
}

/**
 * Checks if a role has write permissions (non-viewer).
 */
export function canWrite(role: string): boolean {
  const meta = ROLES[role as MemberRole];
  return meta ? !meta.isReadOnly : false;
}

/**
 * Checks if a role is permitted to mark obligations as filed.
 */
export function canFileObligation(role: string): boolean {
  const meta = ROLES[role as MemberRole];
  return meta ? meta.canFile : false;
}

/**
 * Checks if a role is permitted to invite or manage members.
 */
export function canManageMembers(role: string): boolean {
  const meta = ROLES[role as MemberRole];
  return meta ? meta.canManageMembers : false;
}
