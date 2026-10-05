import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { auth, type MemberRole } from '@repo/auth/server';
import { and, eq, db, memberships } from '@repo/db';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';

export type AuthenticatedRequest = Request & {
  authSession?: Awaited<ReturnType<typeof auth.api.getSession>>;
  organizationId?: string;
  userRole?: MemberRole;
};

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session?.user) throw new UnauthorizedException('Authentication required');

    request.authSession = session;

    // Check for explicit organization header or resolve primary membership
    const requestedOrgId = (request.headers['x-organization-id'] as string) || (session.session as { activeOrganizationId?: string }).activeOrganizationId;

    const [userMembership] = await db
      .select({
        organizationId: memberships.organizationId,
        role: memberships.role,
      })
      .from(memberships)
      .where(
        requestedOrgId
          ? and(eq(memberships.userId, session.user.id), eq(memberships.organizationId, requestedOrgId))
          : eq(memberships.userId, session.user.id)
      )
      .limit(1);

    if (!userMembership) {
      throw new ForbiddenException('User does not belong to any organization');
    }

    request.organizationId = userMembership.organizationId;
    request.userRole = userMembership.role as MemberRole;

    return true;
  }
}
