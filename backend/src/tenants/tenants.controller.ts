import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../common/auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.admin)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  async list() {
    return this.tenantsService.list();
  }

  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number) {
    return this.tenantsService.getById(id);
  }

  @Post()
  async create(@Body() body: { name?: string }) {
    return this.tenantsService.create(String(body.name || ''));
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string }) {
    return this.tenantsService.update(id, String(body.name || ''));
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.tenantsService.remove(id);
  }
}
