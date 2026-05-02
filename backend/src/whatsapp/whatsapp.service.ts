import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildTenantInstanceName } from '../common/tenant.util';

type EvolutionConnectResult = {
  instanceName: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  phoneNumber?: string | null;
  qrCodeBase64?: string | null;
  lastError?: string | null;
};

@Injectable()
export class WhatsappService {
  constructor(private readonly prisma: PrismaService) {}

  private get baseUrl() {
    return String(process.env.EVOLUTION_API_URL || 'http://evolution-api:8080').replace(/\/$/, '');
  }

  private get apiKey() {
    return String(process.env.EVOLUTION_API_KEY || '');
  }

  private get webhookUrl() {
    return String(
      process.env.EVOLUTION_WEBHOOK_URL || 'http://backend:4000/webhooks/evolution',
    ).replace(/\/$/, '');
  }

  private get defaultHeaders() {
    return {
      'Content-Type': 'application/json',
      apikey: this.apiKey,
    };
  }

  private async requestJson(url: string, init?: RequestInit) {
    const response = await fetch(url, init);
    const text = await response.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    if (!response.ok) {
      throw new Error(`${response.status} ${JSON.stringify(json)}`);
    }

    return json;
  }

  extractMessageId(payload: unknown) {
    const value = payload as any;
    return String(
      value?.key?.id ??
        value?.message?.key?.id ??
        value?.data?.key?.id ??
        value?.data?.message?.key?.id ??
        value?.id ??
        value?.messageId ??
        '',
    ).trim();
  }

  private async getTenantInstanceOrThrow(tenantId: number) {
    let instance = await this.prisma.waInstance.findUnique({
      where: { tenantId },
      include: { tenant: true },
    });

    if (!instance) {
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new NotFoundException('Tenant tidak ditemukan');
      }

      instance = await this.prisma.waInstance.create({
        data: {
          tenantId,
          instanceName: buildTenantInstanceName(tenant.slug),
          status: 'not_created',
        },
        include: { tenant: true },
      });
    }

    return instance;
  }

  private buildWebhookUrl(instanceName: string) {
    const configured = this.webhookUrl;
    const base = configured.replace(/\/webhooks\/evolution(?:\/[^/]+)?$/i, '');
    return `${base}/webhooks/evolution/${encodeURIComponent(instanceName)}`;
  }

  private async configureWebhook(instanceName: string) {
    return this.requestJson(
      `${this.baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`,
      {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify({
          url: this.buildWebhookUrl(instanceName),
          events: ['MESSAGES_UPSERT'],
          webhook_by_events: false,
          webhook_base64: false,
        }),
      },
    );
  }

  private isDuplicateInstanceError(error: unknown) {
    const message = String(error).toLowerCase();
    return message.includes('already in use') || message.includes('already exists') || message.includes('exist');
  }

  private mapConnectionState(state: unknown): EvolutionConnectResult['status'] {
    const value = String(state || '').toLowerCase();
    if (value.includes('open') || value.includes('connected')) return 'connected';
    if (value.includes('close') || value.includes('disconnect') || value.includes('logout')) {
      return 'disconnected';
    }
    return 'connecting';
  }

  private async fetchConnectionState(instanceName: string) {
    return this.requestJson(
      `${this.baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`,
      { method: 'GET', headers: { apikey: this.apiKey } },
    );
  }

  private extractConnectionStateText(state: any) {
    return (
      state?.instance?.state ??
      state?.instance?.status ??
      state?.instance?.connectionStatus ??
      state?.state ??
      state?.status ??
      state?.connectionStatus ??
      ''
    );
  }

  private extractPhoneNumber(state: any) {
    return String(
      state?.instance?.number ??
        state?.instance?.phoneNumber ??
        state?.instance?.owner ??
        state?.number ??
        state?.phoneNumber ??
        state?.owner ??
        '',
    ).replace(/\D/g, '') || null;
  }

  private async persistInstance(
    tenantId: number,
    instanceName: string,
    update: {
      phoneNumber?: string | null;
      status: EvolutionConnectResult['status'] | 'not_created';
      qrCodeBase64?: string | null;
      lastError?: string | null;
    },
  ) {
    const nowConnected = update.status === 'connected' ? new Date() : undefined;

    return this.prisma.waInstance.upsert({
      where: { tenantId },
      update: {
        instanceName,
        phoneNumber: update.phoneNumber ?? null,
        status: update.status,
        qrCodeBase64: update.qrCodeBase64 ?? null,
        lastError: update.lastError ?? null,
        lastConnectedAt: nowConnected,
      },
      create: {
        tenantId,
        instanceName,
        phoneNumber: update.phoneNumber ?? null,
        status: update.status,
        qrCodeBase64: update.qrCodeBase64 ?? null,
        lastError: update.lastError ?? null,
        lastConnectedAt: nowConnected ?? null,
      },
    });
  }

  async getInstance(tenantId: number) {
    const instance = await this.getTenantInstanceOrThrow(tenantId);

    try {
      const state = await this.fetchConnectionState(instance.instanceName);
      const status = this.mapConnectionState(this.extractConnectionStateText(state));
      const phoneNumber = this.extractPhoneNumber(state) ?? instance.phoneNumber;

      return this.persistInstance(tenantId, instance.instanceName, {
        status,
        phoneNumber,
        qrCodeBase64: status === 'connected' ? null : instance.qrCodeBase64,
        lastError: status === 'connected' ? null : instance.lastError,
      });
    } catch {
      return instance;
    }
  }

  async getInstanceByName(instanceName: string) {
    return this.prisma.waInstance.findUnique({
      where: { instanceName },
      include: { tenant: true },
    });
  }

  async connectInstance(tenantId: number) {
    const instance = await this.getTenantInstanceOrThrow(tenantId);
    const instanceName = instance.instanceName;
    let createError: string | null = null;

    try {
      await this.requestJson(`${this.baseUrl}/instance/create`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify({
          instanceName,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
          token: '',
          rejectCall: true,
          groupsIgnore: true,
          alwaysOnline: true,
          readMessages: true,
          readStatus: true,
          syncFullHistory: false,
          webhook: {
            url: this.buildWebhookUrl(instanceName),
            byEvents: false,
            base64: false,
            events: ['MESSAGES_UPSERT'],
          },
        }),
      });
    } catch (error) {
      if (!this.isDuplicateInstanceError(error)) {
        createError = String(error);
      }
    }

    let status: EvolutionConnectResult['status'] = 'connecting';
    let qrCodeBase64: string | null = null;
    let phoneNumber: string | null = null;
    let lastError: string | null = createError;

    try {
      const payload = await this.requestJson(
        `${this.baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`,
        {
          method: 'GET',
          headers: { apikey: this.apiKey },
        },
      );

      qrCodeBase64 = payload.base64 ?? payload.qrcode?.base64 ?? null;

      const state = await this.fetchConnectionState(instanceName);
      const stateText = this.extractConnectionStateText(state);
      phoneNumber = this.extractPhoneNumber(state);

      status = this.mapConnectionState(stateText);
      if (status === 'connected') {
        qrCodeBase64 = null;
      }

      try {
        await this.configureWebhook(instanceName);
      } catch (error) {
        lastError = lastError
          ? `${lastError} | webhook: ${String(error)}`
          : `webhook: ${String(error)}`;
      }
    } catch (error) {
      status = 'error';
      lastError = createError ? `${createError} | connect: ${String(error)}` : String(error);
    }

    return this.persistInstance(tenantId, instanceName, {
      phoneNumber,
      status,
      qrCodeBase64,
      lastError,
    });
  }

  async disconnectInstance(tenantId: number) {
    const instance = await this.getTenantInstanceOrThrow(tenantId);
    let lastError: string | null = null;

    try {
      await this.requestJson(
        `${this.baseUrl}/instance/logout/${encodeURIComponent(instance.instanceName)}`,
        {
          method: 'DELETE',
          headers: { apikey: this.apiKey },
        },
      );
    } catch (error) {
      lastError = String(error);
    }

    return this.persistInstance(tenantId, instance.instanceName, {
      status: 'disconnected',
      qrCodeBase64: null,
      lastError,
    });
  }

  async sendText(tenantId: number, phone: string, text: string) {
    const instance = await this.getTenantInstanceOrThrow(tenantId);

    return this.requestJson(
      `${this.baseUrl}/message/sendText/${encodeURIComponent(instance.instanceName)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.apiKey,
        },
        body: JSON.stringify({
          number: phone,
          text,
          delay: 0,
          linkPreview: false,
        }),
      },
    );
  }
}
