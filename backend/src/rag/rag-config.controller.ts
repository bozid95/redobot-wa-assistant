import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthGuard, SessionPayload } from '../common/auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import {
  AssistantFlowInput,
  AssistantTemplateInput,
  RagConfigInput,
} from './rag-config.defaults';
import { RagConfigService } from './rag-config.service';
import { ConversationTurn, RagService } from './rag.service';

@Controller('rag-config')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.platform_admin)
export class RagConfigController {
  constructor(
    private readonly ragConfigService: RagConfigService,
    private readonly ragService: RagService,
  ) {}

  private resolveTenantId(request: { user?: SessionPayload }, candidate?: string) {
    const user = request.user
    const requestedTenantId = candidate ? Number(candidate) : null
    if (
      user?.role === UserRole.platform_admin &&
      requestedTenantId &&
      Number.isInteger(requestedTenantId) &&
      requestedTenantId > 0
    ) {
      return requestedTenantId
    }

    const tenantId = user?.tenantId
    if (!tenantId) {
      throw new BadRequestException('User belum terhubung ke tenant dan tenant target belum dipilih')
    }

    if (
      requestedTenantId &&
      Number.isInteger(requestedTenantId) &&
      requestedTenantId > 0 &&
      requestedTenantId !== tenantId
    ) {
      throw new ForbiddenException('Tenant target tidak sesuai dengan user saat ini')
    }

    return tenantId
  }

  @Get()
  @Roles(UserRole.platform_admin, UserRole.tenant_admin)
  async getCurrent(
    @Req() request: { user?: SessionPayload },
    @Query('tenantId') tenantId?: string,
  ) {
    return this.ragConfigService.getForTenant(this.resolveTenantId(request, tenantId))
  }

  @Get('templates')
  async listTemplates() {
    return this.ragConfigService.listTemplates()
  }

  @Patch()
  @Roles(UserRole.platform_admin, UserRole.tenant_admin)
  async update(
    @Req() request: { user?: SessionPayload },
    @Query('tenantId') tenantId: string | undefined,
    @Body() body: RagConfigInput,
  ) {
    return this.ragConfigService.updateForTenant(this.resolveTenantId(request, tenantId), body || {})
  }

  @Post('templates')
  async createTemplate(@Body() body: AssistantTemplateInput) {
    return this.ragConfigService.createTemplate(body || {})
  }

  @Patch('templates/:id')
  async updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AssistantTemplateInput,
  ) {
    return this.ragConfigService.updateTemplate(id, body || {})
  }

  @Patch('assistant-flow')
  @Roles(UserRole.platform_admin, UserRole.tenant_admin)
  async updateAssistantFlow(
    @Req() request: { user?: SessionPayload },
    @Query('tenantId') tenantId: string | undefined,
    @Body() body: AssistantFlowInput,
  ) {
    return this.ragConfigService.updateAssistantFlowForTenant(this.resolveTenantId(request, tenantId), body || {})
  }

  @Patch('assistant-flow/reset')
  @Roles(UserRole.platform_admin, UserRole.tenant_admin)
  async resetAssistantFlow(
    @Req() request: { user?: SessionPayload },
    @Query('tenantId') tenantId: string | undefined,
  ) {
    return this.ragConfigService.resetAssistantFlowForTenant(
      this.resolveTenantId(request, tenantId),
    )
  }

  @Patch('template-assignment')
  async assignTemplate(
    @Req() request: { user?: SessionPayload },
    @Query('tenantId') tenantId: string | undefined,
    @Body()
    body: {
      templateId?: number | string | null
      clearAssistantFlowOverride?: boolean
    },
  ) {
    const rawTemplateId = body?.templateId
    const templateId =
      rawTemplateId == null || rawTemplateId === ''
        ? null
        : Number.isInteger(Number(rawTemplateId)) && Number(rawTemplateId) > 0
          ? Number(rawTemplateId)
          : null

    return this.ragConfigService.assignTemplateToTenant(
      this.resolveTenantId(request, tenantId),
      templateId,
      Boolean(body?.clearAssistantFlowOverride),
    )
  }

  @Post('test')
  @Roles(UserRole.platform_admin, UserRole.tenant_admin)
  async test(
    @Req() request: { user?: SessionPayload },
    @Query('tenantId') tenantIdQuery: string | undefined,
    @Body()
    body: {
      question?: string
      history?: ConversationTurn[]
      config?: RagConfigInput
    },
  ) {
    const tenantId = this.resolveTenantId(request, tenantIdQuery)
    const question = this.ragConfigService.validateTestQuestion(String(body.question || ''))
    return this.ragService.test({
      tenantId,
      question,
      history: Array.isArray(body.history) ? body.history : [],
      configOverride: body.config || {},
    })
  }
}
