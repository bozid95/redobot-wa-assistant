import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AppUser, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { compareSync, hashSync } from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { buildTenantInstanceName, getDefaultTenantName, getDefaultTenantSlug } from '../common/tenant.util';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureDefaultTenant() {
    const slug = getDefaultTenantSlug();
    const name = getDefaultTenantName();
    const instanceName = String(process.env.EVOLUTION_INSTANCE_NAME || buildTenantInstanceName(slug)).trim();

    const tenant = await this.prisma.tenant.upsert({
      where: { slug },
      update: { name },
      create: { slug, name },
    });

    const waInstance = await this.prisma.waInstance.findUnique({
      where: { tenantId: tenant.id },
    });

    if (!waInstance) {
      await this.prisma.waInstance.upsert({
        where: { instanceName },
        update: { tenantId: tenant.id },
        create: {
          tenantId: tenant.id,
          instanceName,
          status: 'not_created',
        },
      });
    }

    return tenant;
  }

  private signToken(user: {
    id: number;
    email: string;
    name: string;
    role: UserRole;
    tenantId: number | null;
    isActive: boolean;
  }) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        isActive: user.isActive,
      },
      process.env.JWT_SECRET || 'jwt-secret',
      { expiresIn: '7d' },
    );
  }

  private mapUser(user: AppUser & { tenant?: { name: string } | null }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId ?? null,
      tenantName: user.tenant?.name ?? null,
      isActive: user.isActive,
    };
  }

  async ensureAdminSeed() {
    const tenant = await this.ensureDefaultTenant();
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
          role: 'admin',
          tenantId: tenant.id,
          isActive: true,
        },
      });
      return;
    }

    await this.prisma.appUser.update({
      where: { id: existing.id },
      data: {
        name,
        tenantId: existing.tenantId ?? tenant.id,
        role: 'admin',
        isActive: true,
      },
    });
  }

  async login(email: string, password: string) {
    await this.ensureAdminSeed();
    const user = await this.prisma.appUser.findUnique({
      where: { email },
      include: { tenant: true },
    });
    if (!user || !compareSync(password, user.passwordHash)) {
      throw new UnauthorizedException('Email atau password salah');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Akun tidak aktif');
    }

    const token = this.signToken(user);

    return {
      token,
      user: this.mapUser(user),
    };
  }

  async getMe(id: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id },
      include: { tenant: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid session');
    }

    return this.mapUser(user);
  }

  async updateProfile(id: number, name: string) {
    if (!name.trim()) {
      throw new BadRequestException('Nama wajib diisi');
    }

    const user = await this.prisma.appUser.update({
      where: { id },
      data: { name: name.trim() },
      include: { tenant: true },
    });

    return {
      token: this.signToken(user),
      user: this.mapUser(user),
    };
  }

  async changePassword(id: number, currentPassword: string, newPassword: string) {
    if (!currentPassword.trim() || !newPassword.trim()) {
      throw new BadRequestException('Password lama dan baru wajib diisi');
    }
    if (newPassword.trim().length < 8) {
      throw new BadRequestException('Password baru minimal 8 karakter');
    }

    const user = await this.prisma.appUser.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    if (!compareSync(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Password lama salah');
    }

    await this.prisma.appUser.update({
      where: { id },
      data: { passwordHash: hashSync(newPassword, 10) },
    });

    return { ok: true };
  }
}
