import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

type KnowledgeArticleInput = {
  title: string;
  content: string;
};

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  private get uploadDir() {
    return process.env.UPLOAD_DIR || '/app/uploads';
  }

  private get tikaUrl() {
    return String(process.env.TIKA_URL || 'http://tika:9998').replace(/\/$/, '');
  }

  async list() {
    return this.prisma.knowledgeSource.findMany({
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getById(id: number) {
    return this.prisma.knowledgeSource.findUnique({
      where: { id },
    });
  }

  async createArticle(input: KnowledgeArticleInput) {
    return this.prisma.knowledgeSource.create({
      data: {
        title: input.title.trim(),
        content: input.content.trim(),
        sourceType: 'text',
        sourcePath: null,
        status: 'pending',
      },
    });
  }

  async updateArticle(id: number, input: KnowledgeArticleInput) {
    return this.prisma.knowledgeSource.update({
      where: { id },
      data: {
        title: input.title.trim(),
        content: input.content.trim(),
        status: 'pending',
      },
    });
  }

  async deleteArticle(id: number) {
    const source = await this.prisma.knowledgeSource.findUnique({
      where: { id },
    });
    if (!source) {
      return { ok: true };
    }

    const docId = crypto
      .createHash('sha256')
      .update(source.sourcePath || `knowledge:${source.id}:${source.title}`)
      .digest('hex');

    await fetch(
      `${process.env.QDRANT_URL || 'http://qdrant:6333'}/collections/${encodeURIComponent(process.env.QDRANT_COLLECTION || 'wa_kb')}/points/delete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            must: [{ key: 'doc_id', match: { value: docId } }],
          },
        }),
      },
    ).catch(() => undefined);

    await this.prisma.knowledgeSource.delete({
      where: { id },
    });

    return { ok: true };
  }

  private cleanText(value: string) {
    return String(value || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|section|article)>/gi, '\n')
      .replace(/<li>/gi, '- ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\r/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private splitIntoChunks(pageText: string, pageNumber: number, docMeta: any) {
    const targetTokens = Number(process.env.CHUNK_TARGET_TOKENS || 700);
    const overlapTokens = Number(process.env.CHUNK_OVERLAP_TOKENS || 100);
    const words = pageText.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const wordsPerChunk = Math.max(150, Math.floor(targetTokens * 0.75));
    const overlapWords = Math.max(20, Math.floor(overlapTokens * 0.75));
    const chunks: Array<{ id: string; payload: Record<string, unknown> }> = [];

    for (let start = 0; start < words.length; start += wordsPerChunk - overlapWords) {
      const text = words.slice(start, start + wordsPerChunk).join(' ').trim();
      if (!text) continue;
      const chunkIndex = chunks.length;
      const vectorSeed = `${docMeta.docId}:${pageNumber}:${chunkIndex}:${text.slice(0, 80)}`;
      const hex = crypto.createHash('sha1').update(vectorSeed).digest('hex');
      chunks.push({
        id: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`,
        payload: {
          doc_id: docMeta.docId,
          title: docMeta.title,
          source_type: docMeta.sourceType,
          source_path: docMeta.sourcePath,
          page: pageNumber,
          chunk_index: chunkIndex,
          updated_at: docMeta.updatedAt,
          language: process.env.DEFAULT_LANGUAGE || 'id',
          text,
        },
      });
    }

    return chunks;
  }

  private async ensureCollection() {
    await fetch(`${process.env.QDRANT_URL || 'http://qdrant:6333'}/collections/${encodeURIComponent(process.env.QDRANT_COLLECTION || 'wa_kb')}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectors: {
          size: Number(process.env.QDRANT_VECTOR_SIZE || 1536),
          distance: 'Cosine',
        },
      }),
    });
  }

  private async extractText(filePath: string, originalName: string) {
    const ext = path.extname(originalName).toLowerCase();
    if (ext === '.md' || ext === '.txt') {
      return fs.readFileSync(filePath, 'utf8');
    }

    const buffer = fs.readFileSync(filePath);
    const response = await fetch(`${this.tikaUrl}/tika/text`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${originalName}"`,
      },
      body: buffer,
    });

    return response.text();
  }

  async reindex(ids?: number[]) {
    const sources = await this.prisma.knowledgeSource.findMany({
      where: ids?.length ? { id: { in: ids } } : undefined,
      orderBy: { createdAt: 'asc' },
    });

    await this.ensureCollection();
    const results: Array<Record<string, unknown>> = [];

    for (const source of sources) {
      try {
        const rawText =
          source.sourceType === 'text'
            ? source.content
            : await this.extractText(String(source.sourcePath || ''), source.title);
        const cleaned = this.cleanText(rawText);
        const pages = cleaned.includes('\f')
          ? cleaned.split(/\f+/).map((page) => this.cleanText(page)).filter(Boolean)
          : [cleaned];

        const docId = crypto
          .createHash('sha256')
          .update(source.sourcePath || `knowledge:${source.id}:${source.title}`)
          .digest('hex');
        const docMeta = {
          docId,
          title: source.title,
          sourceType: source.sourceType,
          sourcePath: source.sourcePath || `knowledge://${source.id}`,
          updatedAt: new Date().toISOString(),
        };

        await fetch(
          `${process.env.QDRANT_URL || 'http://qdrant:6333'}/collections/${encodeURIComponent(process.env.QDRANT_COLLECTION || 'wa_kb')}/points/delete`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filter: {
                must: [{ key: 'doc_id', match: { value: docId } }],
              },
            }),
          },
        );

        const chunks = pages.flatMap((pageText, index) =>
          this.splitIntoChunks(pageText, index + 1, docMeta),
        );

        if (!chunks.length) {
          await this.prisma.knowledgeSource.update({
            where: { id: source.id },
            data: { status: 'error' },
          });
          results.push({ id: source.id, status: 'skipped_empty' });
          continue;
        }

        const embeddingRes = await fetch(`${process.env.EMBEDDING_BASE_URL}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.EMBEDDING_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.EMBEDDING_MODEL,
            input: chunks.map((chunk) =>
              [
                `Judul dokumen: ${String(chunk.payload.title || source.title)}`,
                `Halaman: ${String(chunk.payload.page || 1)}`,
                `Isi: ${String(chunk.payload.text || '')}`,
              ].join('\n'),
            ),
          }),
        });
        const embeddingJson = await embeddingRes.json();
        const points = chunks.map((chunk, index) => ({
          id: chunk.id,
          vector: embeddingJson.data[index].embedding,
          payload: chunk.payload,
        }));

        await fetch(
          `${process.env.QDRANT_URL || 'http://qdrant:6333'}/collections/${encodeURIComponent(process.env.QDRANT_COLLECTION || 'wa_kb')}/points`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points }),
          },
        );

        await this.prisma.knowledgeSource.update({
          where: { id: source.id },
          data: {
            status: 'indexed',
            lastIndexedAt: new Date(),
          },
        });
        results.push({ id: source.id, status: 'indexed', chunks: points.length });
      } catch {
        await this.prisma.knowledgeSource.update({
          where: { id: source.id },
          data: { status: 'error' },
        });
        results.push({ id: source.id, status: 'error' });
      }
    }

    return { ok: true, results };
  }
}
