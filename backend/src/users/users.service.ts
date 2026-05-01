import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';

type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  tenantId: number;
  isActive?: boolean;
};

type UpdateUserInput = {
  name?: string;
  role?: UserRole;
  tenantId?: number;
  isActive?: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureTenantExists(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new BadRequestException('Tenant tidak ditemukan');
    }
    return tenant;
  }

  async list(tenantId?: number) {
    return this.prisma.appUser.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  async create(input: CreateUserInput) {
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    const name = String(input.name || '').trim();

    if (!email || !password || !name) {
      throw new BadRequestException('Email, password, dan nama wajib diisi');
    }
    if (password.length < 8) {
      throw new BadRequestException('Password minimal 8 karakter');
    }

    await this.ensureTenantExists(Number(input.tenantId));

    const existing = await this.prisma.appUser.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email sudah digunakan');
    }

    return this.prisma.appUser.create({
      data: {
        email,
        passwordHash: hashSync(password, 10),
        name,
        role: input.role,
        tenantId: Number(input.tenantId),
        isActive: input.isActive ?? true,
      },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  async update(id: number, input: UpdateUserInput) {
    const user = await this.prisma.appUser.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (input.tenantId != null) {
      await this.ensureTenantExists(Number(input.tenantId));
    }

    return this.prisma.appUser.update({
      where: { id },
      data: {
        ...(input.name != null ? { name: String(input.name).trim() } : {}),
        ...(input.role != null ? { role: input.role } : {}),
        ...(input.tenantId != null ? { tenantId: Number(input.tenantId) } : {}),
        ...(input.isActive != null ? { isActive: Boolean(input.isActive) } : {}),
      },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  async resetPassword(id: number, password: string) {
    const user = await this.prisma.appUser.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    const trimmedPassword = String(password || '');
    if (trimmedPassword.length < 8) {
      throw new BadRequestException('Password minimal 8 karakter');
    }

    await this.prisma.appUser.update({
      where: { id },
      data: {
        passwordHash: hashSync(trimmedPassword, 10),
      },
    });

    return { ok: true };
  }
}
