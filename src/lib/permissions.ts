export type Role = "colaborador" | "atendente" | "gestor" | "admin";

export type Permission =
  | "portal.access"
  | "ticket.create"
  | "ticket.view.own"
  | "ticket.view.queue"
  | "ticket.view.team"
  | "ticket.view.all"
  | "ticket.update.status"
  | "ticket.update.priority"
  | "ticket.assign"
  | "ticket.comment.internal"
  | "users.manage"
  | "roles.manage"
  | "service_desk.view_queues"
  | "service_desk.manage"
  | "dashboard.manage"
  | "dashboard.view.team"
  | "dashboard.view.all";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  colaborador: ["portal.access", "ticket.create", "ticket.view.own", "service_desk.view_queues"],
  atendente: ["portal.access", "ticket.create", "ticket.view.own", "ticket.view.queue", "ticket.update.status", "ticket.update.priority", "ticket.assign", "ticket.comment.internal", "service_desk.view_queues"],
  gestor: ["portal.access", "ticket.create", "ticket.view.own", "ticket.view.queue", "ticket.view.team", "ticket.update.status", "ticket.update.priority", "ticket.assign", "ticket.comment.internal", "dashboard.view.team", "service_desk.view_queues"],
  admin: ["portal.access", "ticket.create", "ticket.view.own", "ticket.view.queue", "ticket.view.team", "ticket.view.all", "ticket.update.status", "ticket.update.priority", "ticket.assign", "ticket.comment.internal", "users.manage", "roles.manage", "service_desk.view_queues", "service_desk.manage", "dashboard.manage", "dashboard.view.team", "dashboard.view.all"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasAnyRolePermission(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((role) => hasPermission(role, permission));
}
