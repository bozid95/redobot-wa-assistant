import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@Query('tenantId') tenantId?: string) {
    return this.usersService.list(tenantId ? Number(tenantId) : undefined);
  }

  @Post()
  async create(
    @Body()
    body: {
      email?: string;
      password?: string;
      name?: string;
      role?: UserRole;
      tenantId?: number;
      isActive?: boolean;
    },
  ) {
    return this.usersService.create({
      email: String(body.email || ''),
      password: String(body.password || ''),
      name: String(body.name || ''),
      role: (body.role as UserRole) || UserRole.user,
      tenantId: Number(body.tenantId),
      isActive: body.isActive,
    });
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      name?: string;
      role?: UserRole;
      tenantId?: number;
      isActive?: boolean;
    },
  ) {
    return this.usersService.update(id, {
      ...(body.name != null ? { name: body.name } : {}),
      ...(body.role != null ? { role: body.role } : {}),
      ...(body.tenantId != null ? { tenantId: Number(body.tenantId) } : {}),
      ...(body.isActive != null ? { isActive: body.isActive } : {}),
    });
  }

  @Post(':id/reset-password')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { password?: string },
  ) {
    return this.usersService.resetPassword(id, String(body.password || ''));
  }
}
