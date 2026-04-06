import type { NextFunction, Request, Response } from "express";
import { Role, type JWTPayload, type PermissionKey } from "@repo/types";
import { AppError } from "./error";
import { authenticate } from "./auth";
import {
  canUserAccessDepartment,
  canUserAccessSection,
  isGlobalRole,
  userHasTeacherAssignment,
} from "../services/scope.service";

const PERMISSIONS: Record<PermissionKey, Array<Role | "*">> = {
  "users:create": [Role.SUPER_ADMIN, Role.ADMIN],
  "users:delete": [Role.SUPER_ADMIN, Role.ADMIN],
  "users:read:any": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD],
  "users:read:section": [Role.CLASS_COORDINATOR, Role.TEACHER],
  "departments:create": [Role.SUPER_ADMIN, Role.ADMIN],
  "departments:update": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD],
  "departments:delete": [Role.SUPER_ADMIN, Role.ADMIN],
  "sections:create": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD],
  "sections:update": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR],
  "sections:delete": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD],
  "sections:assign-coordinator": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD],
  "sections:assign-teacher": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD],
  "subjects:update": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR],
  "subjects:archive": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD],
  "attendance:create": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  "attendance:update": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  "attendance:read:any": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD],
  "attendance:read:section": [Role.CLASS_COORDINATOR, Role.TEACHER],
  "attendance:read:own": [Role.STUDENT],
  "grades:create": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  "grades:update": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  "grades:read:any": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD],
  "grades:read:section": [Role.CLASS_COORDINATOR, Role.TEACHER],
  "grades:read:own": [Role.STUDENT],
  "assignments:create": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  "assignments:delete": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD],
  "assignments:grade": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  "assignments:submit": [Role.STUDENT],
  "contests:create": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  "contests:delete": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD],
  "contests:participate": [Role.STUDENT],
  "events:manage-participants": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  "events:view-participants": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  "hackathons:create": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  "hackathons:update": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  "hackathons:delete": [Role.SUPER_ADMIN, Role.ADMIN],
  "hackathons:register": [Role.STUDENT],
  "teams:create": [Role.STUDENT],
  "teams:approve-requests": [Role.STUDENT],
  "problems:create": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR, Role.TEACHER],
  "problems:delete": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD],
  "profile:update:own": [Role.STUDENT, Role.TEACHER, Role.CLASS_COORDINATOR, Role.DEPARTMENT_HEAD, Role.ADMIN],
  "profile:view:public": ["*"],
  "profile:view:private": [Role.SUPER_ADMIN, Role.ADMIN, Role.DEPARTMENT_HEAD, Role.CLASS_COORDINATOR],
  "skills:update:own": [Role.STUDENT, Role.TEACHER, Role.CLASS_COORDINATOR, Role.DEPARTMENT_HEAD, Role.ADMIN],
  "settings:update:own": [Role.STUDENT, Role.TEACHER, Role.CLASS_COORDINATOR, Role.DEPARTMENT_HEAD, Role.ADMIN],
  "leaderboard:view": ["*"],
  "analytics:platform": [Role.SUPER_ADMIN, Role.ADMIN],
  "analytics:department": [Role.DEPARTMENT_HEAD],
  "analytics:section": [Role.CLASS_COORDINATOR, Role.TEACHER],
  "analytics:own": [Role.STUDENT],
  "notifications:send:platform": [Role.SUPER_ADMIN, Role.ADMIN],
  "notifications:send:department": [Role.DEPARTMENT_HEAD],
  "notifications:send:section": [Role.CLASS_COORDINATOR],
  "notifications:view:own-summary": ["*"],
  "reminders:monitor": [Role.SUPER_ADMIN, Role.ADMIN],
};

export type ScopeResource =
  | {
      ownerId?: string | null;
      sectionId?: string | null;
      departmentId?: string | null;
      subjectId?: string | null;
    }
  | null
  | undefined;

export function hasPermission(userRole: Role, permission: PermissionKey): boolean {
  if (userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN) {
    return true;
  }

  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles.includes("*") || allowedRoles.includes(userRole);
}

export function checkScope(
  user: JWTPayload,
  resourceOwnerId?: string | null,
  resourceSectionId?: string | null,
  resourceDepartmentId?: string | null,
  resourceSubjectId?: string | null
): boolean {
  if (isGlobalRole(user.role)) return true;
  if (resourceOwnerId && user.id === resourceOwnerId) return true;

  if (user.role === Role.DEPARTMENT_HEAD) {
    return canUserAccessDepartment(user, resourceDepartmentId);
  }

  if (user.role === Role.CLASS_COORDINATOR) {
    return canUserAccessSection(user, resourceSectionId);
  }

  if (user.role === Role.TEACHER) {
    return userHasTeacherAssignment(user, resourceSectionId, resourceSubjectId);
  }

  return !resourceOwnerId || user.id === resourceOwnerId;
}

export function requirePermission(permission: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    authenticate(req, res, (authErr?: unknown) => {
      if (authErr) {
        next(authErr);
        return;
      }

      if (!req.user) {
        next(new AppError("Unauthorized", 401));
        return;
      }

      if (!hasPermission(req.user.role, permission)) {
        next(new AppError("Insufficient permissions", 403));
        return;
      }

      next();
    });
  };
}

export function requireScope(getResourceFn: (req: Request) => Promise<ScopeResource> | ScopeResource) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new AppError("Unauthorized", 401);
      }

      const resource = await getResourceFn(req);
      if (!resource) {
        throw new AppError("Resource scope could not be determined", 400);
      }

      const allowed = checkScope(
        req.user,
        resource.ownerId ?? null,
        resource.sectionId ?? null,
        resource.departmentId ?? null,
        resource.subjectId ?? null
      );

      if (!allowed) {
        throw new AppError("Forbidden", 403);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export { PERMISSIONS };
