import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export type SessionPayload = {
  sub: number;
  email: string;
  name: string;
};

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token =
      request.cookies?.wa_rag_session ||
      request.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || 'jwt-secret',
      ) as unknown as SessionPayload;
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid session');
    }
  }
}
