import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasMinimumRole, type MemberRole } from '@repo/auth/server';
import type { AuthenticatedRequest } from './session.guard.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<MemberRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRole = request.userRole;

    if (!userRole) {
      throw new ForbiddenException(
        'No role associated with user in current organization',
      );
    }

    const hasPermission = requiredRoles.some((role) =>
      hasMinimumRole(userRole, role),
    );
    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions. Required role: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
