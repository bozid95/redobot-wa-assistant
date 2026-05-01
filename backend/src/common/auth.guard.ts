import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';

export type SessionPayload = {
  sub: number;
  email: string;
  name: string;
  role: UserRole;
  tenantId: number | null;
  tenantName: string | null;
  isActive: boolean;
};

type TokenPayload = {
  sub: number;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token =
      request.cookies?.wa_rag_session ||
      request.headers?.authorization?.replace(/^Bearer\s+/i, '');

    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }

    let payload: TokenPayload;
    try {
      payload = jwt.verify(
        token,
        process.env.JWT_SECRET || 'jwt-secret',
      ) as unknown as TokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid session');
    }

    const user = await this.prisma.appUser.findUnique({
      where: { id: Number(payload.sub) },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid session');
    }

    request.user = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId ?? null,
      tenantName: user.tenant?.name ?? null,
      isActive: user.isActive,
    } satisfies SessionPayload;

    return true;
  }
}
