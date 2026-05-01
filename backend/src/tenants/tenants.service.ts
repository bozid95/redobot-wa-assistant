import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildTenantInstanceName, slugifyTenantName } from '../common/tenant.util';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureUniqueSlug(baseName: string, excludeId?: number) {
    const base = slugifyTenantName(baseName);

    for (let index = 0; index < 100; index += 1) {
      const slug = index === 0 ? base : `${base}-${index + 1}`;
      const existing = await this.prisma.tenant.findUnique({ where: { slug } });
      if (!existing || existing.id === excludeId) {
        return slug;
      }
    }

    throw new BadRequestException('Slug tenant tidak tersedia');
  }

  private async ensureUniqueInstanceName(baseSlug: string) {
    const base = buildTenantInstanceName(baseSlug);

    for (let index = 0; index < 100; index += 1) {
      const instanceName = index === 0 ? base : `${base}-${index + 1}`;
      const existing = await this.prisma.waInstance.findUnique({ where: { instanceName } });
      if (!existing) {
        return instanceName;
      }
    }

    throw new BadRequestException('Instance WhatsApp tenant tidak tersedia');
  }

  async list() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        waInstances: true,
        ragConfig: {
          select: {
            assistantTemplateId: true,
            assistantTemplate: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                isSystem: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });
  }

  async getById(id: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        waInstances: true,
        ragConfig: {
          select: {
            assistantTemplateId: true,
            assistantTemplate: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                isSystem: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant tidak ditemukan');
    }

    return tenant;
  }

  async create(name: string) {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      throw new BadRequestException('Nama tenant wajib diisi');
    }

    const slug = await this.ensureUniqueSlug(trimmedName);
    const instanceName = await this.ensureUniqueInstanceName(slug);

    return this.prisma.tenant.create({
      data: {
        name: trimmedName,
        slug,
        waInstances: {
          create: {
            instanceName,
            status: 'not_created',
          },
        },
      },
      include: {
        waInstances: true,
      },
    });
  }

  async update(id: number, name: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant tidak ditemukan');
    }

    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      throw new BadRequestException('Nama tenant wajib diisi');
    }

    const nextSlug = await this.ensureUniqueSlug(trimmedName, id);

    return this.prisma.tenant.update({
      where: { id },
      data: {
        name: trimmedName,
        slug: nextSlug,
      },
      include: {
        waInstances: true,
      },
    });
  }

  async remove(id: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true },
        },
        waInstances: {
          select: { id: true },
        },
        knowledgeSources: {
          select: { id: true },
        },
        conversations: {
          select: { id: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant tidak ditemukan');
    }

    await this.prisma.tenant.delete({
      where: { id },
    });

    return {
      id: tenant.id,
      name: tenant.name,
      detachedUsers: tenant.users.length,
      detachedInstances: tenant.waInstances.length,
      detachedKnowledgeSources: tenant.knowledgeSources.length,
      detachedConversations: tenant.conversations.length,
    };
  }
}
