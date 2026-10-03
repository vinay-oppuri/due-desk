import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { auth } from '@repo/auth/server';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';

export type AuthenticatedRequest = Request & {
  authSession?: Awaited<ReturnType<typeof auth.api.getSession>>;
};

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session?.user) throw new UnauthorizedException();
    request.authSession = session;
    return true;
  }
}
