import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import { hasPaginationQuery, paginated, PaginationQuery, sanitizePagination } from '../common/pagination.util';

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

  async list(tenantId?: number, query: PaginationQuery & { search?: string } = {}) {
    const search = String(query.search || '').trim();
    const where: Prisma.AppUserWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const findQuery: Prisma.AppUserFindManyArgs = {
      where,
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    };

    if (!hasPaginationQuery(query)) {
      return this.prisma.appUser.findMany(findQuery);
    }

    const { page, limit, skip, take } = sanitizePagination(query, 10);
    const [total, items] = await Promise.all([
      this.prisma.appUser.count({ where }),
      this.prisma.appUser.findMany({ ...findQuery, skip, take }),
    ]);

    return paginated(items, total, page, limit);
  }

  async getById(id: number) {
    const user = await this.prisma.appUser.findUnique({
      where: { id },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    return user;
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

  async remove(id: number, actorId?: number) {
    const user = await this.prisma.appUser.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    if (actorId != null && Number(actorId) === id) {
      throw new BadRequestException('User yang sedang login tidak bisa menghapus dirinya sendiri');
    }

    if (user.role === UserRole.platform_admin) {
      const adminCount = await this.prisma.appUser.count({
        where: { role: UserRole.platform_admin, isActive: true },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Minimal harus ada satu platform admin aktif di sistem');
      }
    }

    await this.prisma.appUser.delete({ where: { id } });

    return { ok: true };
  }
}
