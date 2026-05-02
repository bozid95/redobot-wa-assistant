import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { slugifyTenantName } from '../common/tenant.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  AssistantFlowActionType,
  AssistantFlowDraft,
  AssistantFlowFieldType,
  AssistantFlowInput,
  AssistantFlowSource,
  AssistantTemplateInput,
  AssistantTemplateSummary,
  createDefaultAssistantFlowDraft,
  getDefaultRagConfig,
  RagConfigInput,
  RagConfigValues,
} from './rag-config.defaults';

type AssistantTemplateRecord = {
  id: number
  name: string
  slug: string
  description: string | null
  isSystem: boolean
  updatedAt: Date
  assistantFlow: unknown
}

type RagConfigRecord = {
  assistantName: string | null
  businessContext: string | null
  greetingMessage: string | null
  clarifyMessage: string | null
  fallbackMessage: string | null
  thanksMessage: string | null
  salesCtaNew: string | null
  salesCtaInterested: string | null
  salesCtaHot: string | null
  salesCtaHandoff: string | null
  systemPrompt: string | null
  paymentPrompt: string | null
  scoreThreshold: number | null
  topK: number | null
  maxChunks: number | null
  chunkTargetTokens: number | null
  assistantFlow: unknown | null
  assistantTemplateId: number | null
  assistantTemplate: AssistantTemplateRecord | null
  updatedAt: Date | null
}

export type RagConfigResponse = {
  config: RagConfigValues
  defaults: RagConfigValues
  updatedAt: string | null
  hasCustomConfig: boolean
  assistantFlow: AssistantFlowDraft
  assistantFlowExample: AssistantFlowDraft
  assistantFlowPersisted: boolean
  assistantFlowSource: AssistantFlowSource
  assignedTemplateId: number | null
  assignedTemplate: AssistantTemplateSummary | null
}

@Injectable()
export class RagConfigService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly allowedActionTypes = new Set<AssistantFlowActionType>([
    'answer_from_knowledge',
    'collect_fields',
    'handoff_admin',
    'send_payment_info',
    'send_custom_message',
  ])

  private readonly allowedFieldTypes = new Set<AssistantFlowFieldType>([
    'text',
    'phone',
    'date',
    'select',
    'textarea',
  ])

  private sanitizeString(value: unknown) {
    return String(value ?? '').trim()
  }

  private sanitizeNumber(value: unknown, fallback: number, min: number, max: number) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return fallback
    return Math.min(max, Math.max(min, numeric))
  }

  private sanitizeOptionalNumber(value: unknown, min: number, max: number) {
    if (value == null || value === '') return null
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return null
    return Math.min(max, Math.max(min, numeric))
  }

  private sanitizeBoolean(value: unknown, fallback = false) {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
      if (['0', 'false', 'no', 'off'].includes(normalized)) return false
    }
    if (typeof value === 'number') return value !== 0
    return fallback
  }

  private asRecord(value: unknown) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  }

  private sanitizeStringArray(value: unknown, fallback: string[] = []) {
    if (!Array.isArray(value)) return [...fallback]
    return value
      .map((item) => this.sanitizeString(item))
      .filter(Boolean)
  }

  private sanitizeIdentifier(value: unknown, fallback: string) {
    const normalized = this.sanitizeString(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

    return normalized || fallback
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue
  }

  private async ensureTenant(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) {
      throw new NotFoundException('Tenant tidak ditemukan')
    }
    return tenant
  }

  private async ensureTemplateSeed() {
    const total = await this.prisma.assistantTemplate.count()
    if (total > 0) return

    const defaultConfig = getDefaultRagConfig()
    const assistantFlow = createDefaultAssistantFlowDraft(defaultConfig)

    await this.prisma.assistantTemplate.create({
      data: {
        name: 'Generic Customer Service',
        slug: 'generic-customer-service',
        description:
          'Template awal untuk bisnis yang butuh FAQ, lead capture, handoff admin, dan booking sederhana.',
        isSystem: true,
        assistantFlow: this.toJsonValue(assistantFlow),
      },
    })
  }

  private async ensureUniqueTemplateSlug(baseName: string, excludeId?: number) {
    const base = slugifyTenantName(baseName) || 'assistant-template'

    for (let index = 0; index < 100; index += 1) {
      const slug = index === 0 ? base : `${base}-${index + 1}`
      const existing = await this.prisma.assistantTemplate.findUnique({ where: { slug } })
      if (!existing || existing.id === excludeId) {
        return slug
      }
    }

    throw new BadRequestException('Slug template tidak tersedia')
  }

  private normalizeInput(input: RagConfigInput, defaults: RagConfigValues): RagConfigValues {
    return {
      assistantName: this.sanitizeString(input.assistantName) || defaults.assistantName,
      businessContext: this.sanitizeString(input.businessContext) || defaults.businessContext,
      greetingMessage: this.sanitizeString(input.greetingMessage) || defaults.greetingMessage,
      clarifyMessage: this.sanitizeString(input.clarifyMessage) || defaults.clarifyMessage,
      fallbackMessage: this.sanitizeString(input.fallbackMessage) || defaults.fallbackMessage,
      thanksMessage: this.sanitizeString(input.thanksMessage) || defaults.thanksMessage,
      salesCtaNew: this.sanitizeString(input.salesCtaNew) || defaults.salesCtaNew,
      salesCtaInterested:
        this.sanitizeString(input.salesCtaInterested) || defaults.salesCtaInterested,
      salesCtaHot: this.sanitizeString(input.salesCtaHot) || defaults.salesCtaHot,
      salesCtaHandoff: this.sanitizeString(input.salesCtaHandoff) || defaults.salesCtaHandoff,
      systemPrompt: this.sanitizeString(input.systemPrompt) || defaults.systemPrompt,
      paymentPrompt: this.sanitizeString(input.paymentPrompt) || defaults.paymentPrompt,
      scoreThreshold: this.sanitizeNumber(input.scoreThreshold, defaults.scoreThreshold, 0.1, 0.95),
      topK: Math.round(this.sanitizeNumber(input.topK, defaults.topK, 1, 12)),
      maxChunks: Math.round(this.sanitizeNumber(input.maxChunks, defaults.maxChunks, 1, 8)),
      chunkTargetTokens: Math.round(
        this.sanitizeNumber(input.chunkTargetTokens, defaults.chunkTargetTokens, 200, 1500),
      ),
    }
  }

  private normalizeAssistantFlow(input: unknown, defaults: AssistantFlowDraft): AssistantFlowDraft {
    const record = this.asRecord(input) || {}
    const profile = this.asRecord(record.profile) || {}
    const advanced = this.asRecord(record.advanced) || {}

    return {
      profile: {
        assistantName: this.sanitizeString(profile.assistantName) || defaults.profile.assistantName,
        businessContext:
          this.sanitizeString(profile.businessContext) || defaults.profile.businessContext,
        greetingMessage:
          this.sanitizeString(profile.greetingMessage) || defaults.profile.greetingMessage,
        clarifyMessage:
          this.sanitizeString(profile.clarifyMessage) || defaults.profile.clarifyMessage,
        fallbackMessage:
          this.sanitizeString(profile.fallbackMessage) || defaults.profile.fallbackMessage,
        thanksMessage: this.sanitizeString(profile.thanksMessage) || defaults.profile.thanksMessage,
        menuEnabled: false,
        menuItems: [],
      },
      intents:
        Array.isArray(record.intents) && record.intents.length
          ? record.intents.map((item, index) => {
              const intent = this.asRecord(item) || {}
              return {
                id: this.sanitizeString(intent.id) || `intent-${index + 1}`,
                key: this.sanitizeIdentifier(intent.key, `intent_${index + 1}`),
                label: this.sanitizeString(intent.label) || `Intent ${index + 1}`,
                keywords: this.sanitizeStringArray(intent.keywords),
                searchHints: this.sanitizeStringArray(intent.searchHints),
                defaultAction: this.sanitizeString(intent.defaultAction) || null,
              }
            })
          : defaults.intents,
      fields:
        Array.isArray(record.fields) && record.fields.length
          ? record.fields.map((item, index) => {
              const field = this.asRecord(item) || {}
              const type = this.sanitizeString(field.type) as AssistantFlowFieldType
              return {
                id: this.sanitizeString(field.id) || `field-${index + 1}`,
                key: this.sanitizeIdentifier(field.key, `field_${index + 1}`),
                label: this.sanitizeString(field.label) || `Field ${index + 1}`,
                type: this.allowedFieldTypes.has(type) ? type : defaults.fields[0]?.type || 'text',
                required: this.sanitizeBoolean(field.required),
                placeholder: this.sanitizeString(field.placeholder),
                helpText: this.sanitizeString(field.helpText),
                options: this.sanitizeStringArray(field.options),
              }
            })
          : defaults.fields,
      actions:
        Array.isArray(record.actions) && record.actions.length
          ? record.actions.map((item, index) => {
              const action = this.asRecord(item) || {}
              const type = this.sanitizeString(action.type) as AssistantFlowActionType
              return {
                id: this.sanitizeString(action.id) || `action-${index + 1}`,
                key: this.sanitizeIdentifier(action.key, `action_${index + 1}`),
                type: this.allowedActionTypes.has(type)
                  ? type
                  : defaults.actions[0]?.type || 'send_custom_message',
                label: this.sanitizeString(action.label) || `Action ${index + 1}`,
                messageTemplate: this.sanitizeString(action.messageTemplate),
                fieldKeys: this.sanitizeStringArray(action.fieldKeys),
              }
            })
          : defaults.actions,
      routingRules:
        Array.isArray(record.routingRules) && record.routingRules.length
          ? record.routingRules.map((item, index) => {
              const rule = this.asRecord(item) || {}
              return {
                id: this.sanitizeString(rule.id) || `rule-${index + 1}`,
                intentKey: this.sanitizeString(rule.intentKey),
                actionKey: this.sanitizeString(rule.actionKey),
                ifMissingFields: this.sanitizeStringArray(rule.ifMissingFields),
                ifConfidenceBelow: this.sanitizeOptionalNumber(rule.ifConfidenceBelow, 0, 1),
              }
            })
          : defaults.routingRules,
      advanced: {
        systemPrompt: this.sanitizeString(advanced.systemPrompt) || defaults.advanced.systemPrompt,
        paymentPrompt:
          this.sanitizeString(advanced.paymentPrompt) || defaults.advanced.paymentPrompt,
        scoreThreshold: this.sanitizeNumber(
          advanced.scoreThreshold,
          defaults.advanced.scoreThreshold,
          0.1,
          0.95,
        ),
        topK: Math.round(this.sanitizeNumber(advanced.topK, defaults.advanced.topK, 1, 12)),
        maxChunks: Math.round(
          this.sanitizeNumber(advanced.maxChunks, defaults.advanced.maxChunks, 1, 8),
        ),
        chunkTargetTokens: Math.round(
          this.sanitizeNumber(
            advanced.chunkTargetTokens,
            defaults.advanced.chunkTargetTokens,
            200,
            1500,
          ),
        ),
      },
    }
  }

  private serializeTemplate(
    record: AssistantTemplateRecord,
    defaults: AssistantFlowDraft,
  ): AssistantTemplateSummary {
    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      description: String(record.description || ''),
      isSystem: Boolean(record.isSystem),
      updatedAt: record.updatedAt.toISOString(),
      assistantFlow: this.normalizeAssistantFlow(record.assistantFlow, defaults),
    }
  }

  private resolveAssistantFlow(record: RagConfigRecord | null, config: RagConfigValues) {
    const assistantFlowExample = createDefaultAssistantFlowDraft(config)
    const assignedTemplate = record?.assistantTemplate
      ? this.serializeTemplate(record.assistantTemplate, assistantFlowExample)
      : null

    if (record?.assistantFlow) {
      return {
        assistantFlowSource: 'tenant' as AssistantFlowSource,
        assistantFlowPersisted: true,
        assistantFlow: this.normalizeAssistantFlow(
          record.assistantFlow,
          assignedTemplate?.assistantFlow || assistantFlowExample,
        ),
        assistantFlowExample,
        assignedTemplate,
      }
    }

    if (assignedTemplate) {
      return {
        assistantFlowSource: 'template' as AssistantFlowSource,
        assistantFlowPersisted: false,
        assistantFlow: assignedTemplate.assistantFlow,
        assistantFlowExample,
        assignedTemplate,
      }
    }

    return {
      assistantFlowSource: 'default' as AssistantFlowSource,
      assistantFlowPersisted: false,
      assistantFlow: assistantFlowExample,
      assistantFlowExample,
      assignedTemplate: null,
    }
  }

  private buildConfigResponse(record: RagConfigRecord | null, config: RagConfigValues): RagConfigResponse {
    const resolvedFlow = this.resolveAssistantFlow(record, config)

    return {
      config,
      defaults: getDefaultRagConfig(),
      updatedAt: record?.updatedAt?.toISOString() ?? null,
      hasCustomConfig: this.hasLegacyOverrides(record),
      assistantFlow: resolvedFlow.assistantFlow,
      assistantFlowExample: resolvedFlow.assistantFlowExample,
      assistantFlowPersisted: resolvedFlow.assistantFlowPersisted,
      assistantFlowSource: resolvedFlow.assistantFlowSource,
      assignedTemplateId: resolvedFlow.assignedTemplate?.id ?? record?.assistantTemplateId ?? null,
      assignedTemplate: resolvedFlow.assignedTemplate,
    }
  }

  private hasLegacyOverrides(record: RagConfigRecord | null) {
    if (!record) return false

    return [
      record.assistantName,
      record.businessContext,
      record.greetingMessage,
      record.clarifyMessage,
      record.fallbackMessage,
      record.thanksMessage,
      record.salesCtaNew,
      record.salesCtaInterested,
      record.salesCtaHot,
      record.salesCtaHandoff,
      record.systemPrompt,
      record.paymentPrompt,
      record.scoreThreshold,
      record.topK,
      record.maxChunks,
      record.chunkTargetTokens,
    ].some((value) => value != null)
  }

  async listTemplates() {
    await this.ensureTemplateSeed()

    const records = await this.prisma.assistantTemplate.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    })

    const defaults = createDefaultAssistantFlowDraft(getDefaultRagConfig())
    return records.map((record) =>
      this.serializeTemplate(record as unknown as AssistantTemplateRecord, defaults),
    )
  }

  async createTemplate(input: AssistantTemplateInput) {
    const name = this.sanitizeString(input.name)
    if (!name) {
      throw new BadRequestException('Nama template wajib diisi')
    }

    const defaults = createDefaultAssistantFlowDraft(getDefaultRagConfig())
    const assistantFlow = this.normalizeAssistantFlow(input.assistantFlow, defaults)
    const slug = await this.ensureUniqueTemplateSlug(name)

    const record = await this.prisma.assistantTemplate.create({
      data: {
        name,
        slug,
        description: this.sanitizeString(input.description) || null,
        isSystem: false,
        assistantFlow: this.toJsonValue(assistantFlow),
      },
    })

    return this.serializeTemplate(record as unknown as AssistantTemplateRecord, defaults)
  }

  async updateTemplate(id: number, input: AssistantTemplateInput) {
    const existing = await this.prisma.assistantTemplate.findUnique({ where: { id } })
    if (!existing) {
      throw new NotFoundException('Template tidak ditemukan')
    }

    const nextName = this.sanitizeString(input.name) || existing.name
    if (!nextName) {
      throw new BadRequestException('Nama template wajib diisi')
    }

    const defaults = createDefaultAssistantFlowDraft(getDefaultRagConfig())
    const assistantFlow = input.assistantFlow
      ? this.normalizeAssistantFlow(input.assistantFlow, defaults)
      : this.normalizeAssistantFlow(existing.assistantFlow, defaults)
    const slug =
      nextName === existing.name ? existing.slug : await this.ensureUniqueTemplateSlug(nextName, id)

    const record = await this.prisma.assistantTemplate.update({
      where: { id },
      data: {
        name: nextName,
        slug,
        description: this.sanitizeString(input.description) || null,
        assistantFlow: this.toJsonValue(assistantFlow),
      },
    })

    return this.serializeTemplate(record as unknown as AssistantTemplateRecord, defaults)
  }

  async assignTemplateToTenant(
    tenantId: number,
    templateId: number | null,
    clearAssistantFlowOverride = false,
  ) {
    await this.ensureTenant(tenantId)

    if (templateId != null) {
      const template = await this.prisma.assistantTemplate.findUnique({
        where: { id: templateId },
      })
      if (!template) {
        throw new NotFoundException('Template tidak ditemukan')
      }
    }

    const existing = await this.prisma.ragConfig.findUnique({ where: { tenantId } })

    if (existing) {
      await this.prisma.ragConfig.update({
        where: { tenantId },
        data: {
          assistantTemplateId: templateId,
          ...(clearAssistantFlowOverride ? { assistantFlow: Prisma.DbNull } : {}),
        },
      })
    } else if (templateId != null) {
      await this.prisma.ragConfig.create({
        data: {
          tenantId,
          assistantTemplateId: templateId,
        },
      })
    }

    return this.getResolvedConfig(tenantId)
  }

  async resetAssistantFlowForTenant(tenantId: number) {
    await this.ensureTenant(tenantId)

    const existing = await this.prisma.ragConfig.findUnique({ where: { tenantId } })
    if (existing) {
      await this.prisma.ragConfig.update({
        where: { tenantId },
        data: {
          assistantFlow: Prisma.DbNull,
        },
      })
    }

    return this.getResolvedConfig(tenantId)
  }

  async getResolvedConfig(tenantId: number, overrides?: RagConfigInput) {
    await this.ensureTenant(tenantId)
    const defaults = getDefaultRagConfig()
    const record = (await this.prisma.ragConfig.findUnique({
      where: { tenantId },
      include: {
        assistantTemplate: true,
      },
    })) as unknown as RagConfigRecord | null

    const resolved = this.normalizeInput(
      {
        assistantName: record?.assistantName ?? undefined,
        businessContext: record?.businessContext ?? undefined,
        greetingMessage: record?.greetingMessage ?? undefined,
        clarifyMessage: record?.clarifyMessage ?? undefined,
        fallbackMessage: record?.fallbackMessage ?? undefined,
        thanksMessage: record?.thanksMessage ?? undefined,
        salesCtaNew: record?.salesCtaNew ?? undefined,
        salesCtaInterested: record?.salesCtaInterested ?? undefined,
        salesCtaHot: record?.salesCtaHot ?? undefined,
        salesCtaHandoff: record?.salesCtaHandoff ?? undefined,
        systemPrompt: record?.systemPrompt ?? undefined,
        paymentPrompt: record?.paymentPrompt ?? undefined,
        scoreThreshold: record?.scoreThreshold ?? undefined,
        topK: record?.topK ?? undefined,
        maxChunks: record?.maxChunks ?? undefined,
        chunkTargetTokens: record?.chunkTargetTokens ?? undefined,
        ...(overrides || {}),
      },
      defaults,
    )

    return this.buildConfigResponse(record, resolved)
  }

  async getForTenant(tenantId: number) {
    return this.getResolvedConfig(tenantId)
  }

  async updateForTenant(tenantId: number, input: RagConfigInput) {
    await this.ensureTenant(tenantId)
    const defaults = getDefaultRagConfig()
    const normalized = this.normalizeInput(input, defaults)
    const existing = await this.prisma.ragConfig.findUnique({
      where: { tenantId },
      select: { assistantFlow: true, assistantTemplateId: true },
    })

    const record = (await this.prisma.ragConfig.upsert({
      where: { tenantId },
      update: normalized,
      create: {
        tenantId,
        ...normalized,
        assistantFlow: existing?.assistantFlow ?? undefined,
        assistantTemplateId: existing?.assistantTemplateId ?? undefined,
      },
      include: {
        assistantTemplate: true,
      },
    })) as unknown as RagConfigRecord

    return this.buildConfigResponse(record, normalized)
  }

  async updateAssistantFlowForTenant(tenantId: number, input: AssistantFlowInput) {
    await this.ensureTenant(tenantId)
    const current = await this.getResolvedConfig(tenantId)
    const normalized = this.normalizeAssistantFlow(
      input,
      current.assignedTemplate?.assistantFlow || current.assistantFlowExample,
    )

    const record = (await this.prisma.ragConfig.upsert({
      where: { tenantId },
      update: {
        assistantFlow: this.toJsonValue(normalized),
      },
      create: {
        tenantId,
        assistantFlow: this.toJsonValue(normalized),
        assistantTemplateId: current.assignedTemplateId ?? undefined,
      },
      include: {
        assistantTemplate: true,
      },
    })) as unknown as RagConfigRecord

    return this.buildConfigResponse(record, current.config)
  }

  validateTestQuestion(question: string) {
    const trimmed = String(question || '').trim()
    if (!trimmed) {
      throw new BadRequestException('Question wajib diisi')
    }
    return trimmed
  }
}
