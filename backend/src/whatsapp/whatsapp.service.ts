import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  private get instanceName() {
    return String(process.env.EVOLUTION_INSTANCE_NAME || 'wa-rag-bot');
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

  private async configureWebhook() {
    return this.requestJson(
      `${this.baseUrl}/webhook/set/${encodeURIComponent(this.instanceName)}`,
      {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify({
          url: this.webhookUrl,
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

  private async fetchConnectionState() {
    return this.requestJson(
      `${this.baseUrl}/instance/connectionState/${encodeURIComponent(this.instanceName)}`,
      { method: 'GET', headers: { apikey: this.apiKey } },
    );
  }

  private async persistInstance(update: {
    phoneNumber?: string | null;
    status: EvolutionConnectResult['status'] | 'not_created';
    qrCodeBase64?: string | null;
    lastError?: string | null;
  }) {
    const nowConnected = update.status === 'connected' ? new Date() : undefined;

    return this.prisma.waInstance.upsert({
      where: { instanceName: this.instanceName },
      update: {
        phoneNumber: update.phoneNumber ?? null,
        status: update.status,
        qrCodeBase64: update.qrCodeBase64 ?? null,
        lastError: update.lastError ?? null,
        lastConnectedAt: nowConnected,
      },
      create: {
        instanceName: this.instanceName,
        phoneNumber: update.phoneNumber ?? null,
        status: update.status,
        qrCodeBase64: update.qrCodeBase64 ?? null,
        lastError: update.lastError ?? null,
        lastConnectedAt: nowConnected ?? null,
      },
    });
  }

  async getInstance() {
    return this.prisma.waInstance.findUnique({
      where: { instanceName: this.instanceName },
    });
  }

  async connectInstance() {
    let createError: string | null = null;

    try {
      await this.requestJson(`${this.baseUrl}/instance/create`, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify({
          instanceName: this.instanceName,
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
            url: this.webhookUrl,
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

    let payload: any = {};
    let status: EvolutionConnectResult['status'] = 'connecting';
    let qrCodeBase64: string | null = null;
    let phoneNumber: string | null = null;
    let lastError: string | null = createError;

    try {
      payload = await this.requestJson(`${this.baseUrl}/instance/connect/${encodeURIComponent(this.instanceName)}`, {
        method: 'GET',
        headers: { apikey: this.apiKey },
      });

      qrCodeBase64 = payload.base64 ?? payload.qrcode?.base64 ?? null;

      const state = await this.fetchConnectionState();

      const stateText = state.instance?.state ?? state.state ?? state.status ?? '';

      phoneNumber = String(state.instance?.number ?? state.number ?? '')
        .replace(/\D/g, '') || null;

      status = this.mapConnectionState(stateText);
      if (status === 'connected') {
        qrCodeBase64 = null;
      }

      try {
        await this.configureWebhook();
      } catch (error) {
        lastError = lastError
          ? `${lastError} | webhook: ${String(error)}`
          : `webhook: ${String(error)}`;
      }
    } catch (error) {
      status = 'error';
      lastError = createError ? `${createError} | connect: ${String(error)}` : String(error);
    }

    return this.persistInstance({
      phoneNumber,
      status,
      qrCodeBase64,
      lastError,
    });
  }

  async disconnectInstance() {
    let lastError: string | null = null;

    try {
      await this.requestJson(`${this.baseUrl}/instance/logout/${encodeURIComponent(this.instanceName)}`, {
        method: 'DELETE',
        headers: { apikey: this.apiKey },
      });
    } catch (error) {
      lastError = String(error);
    }

    return this.persistInstance({
      status: 'disconnected',
      qrCodeBase64: null,
      lastError,
    });
  }

  async sendText(phone: string, text: string) {
    const payload = await this.requestJson(
      `${this.baseUrl}/message/sendText/${encodeURIComponent(this.instanceName)}`,
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

    return payload;
  }
}
