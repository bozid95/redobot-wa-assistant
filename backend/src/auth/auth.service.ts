import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { compareSync, hashSync } from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureAdminSeed() {
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'change-me-dashboard-password';
    const name = process.env.ADMIN_NAME || 'Admin';

    const existing = await this.prisma.appUser.findUnique({ where: { email } });
    if (!existing) {
      await this.prisma.appUser.create({
        data: {
          email,
          passwordHash: hashSync(password, 10),
          name,
        },
      });
    }
  }

  async login(email: string, password: string) {
    await this.ensureAdminSeed();
    const user = await this.prisma.appUser.findUnique({ where: { email } });
    if (!user || !compareSync(password, user.passwordHash)) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET || 'jwt-secret',
      { expiresIn: '7d' },
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }
}
