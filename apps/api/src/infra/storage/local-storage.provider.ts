import { createHmac } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Env } from '@souq/config';
import type { PresignedUpload, StorageObjectInfo, StorageProvider } from './storage.provider';

/**
 * Local filesystem driver for development/tests. "Presigned" URLs are HMAC-signed links
 * served by the API's LocalUploadController, mirroring S3 semantics (expiry, content type).
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly root: string;
  private readonly secret: string;

  constructor(private readonly env: Env) {
    this.root = path.resolve(env.LOCAL_STORAGE_DIR);
    this.secret = env.JWT_ACCESS_SECRET;
  }

  sign(parts: string[]): string {
    return createHmac('sha256', this.secret).update(parts.join('|')).digest('base64url');
  }

  private safePath(bucket: string, key: string): string {
    const p = path.resolve(this.root, bucket, key);
    if (!p.startsWith(this.root + path.sep)) throw new Error('Path traversal detected');
    return p;
  }

  async presignUpload(bucket: string, key: string, contentType: string, maxBytes: number, ttlSeconds: number): Promise<PresignedUpload> {
    const exp = Date.now() + ttlSeconds * 1000;
    const sig = this.sign(['upload', bucket, key, contentType, String(maxBytes), String(exp)]);
    const url = `${this.env.API_URL}/${this.env.API_GLOBAL_PREFIX}/v1/uploads/local/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}?exp=${exp}&max=${maxBytes}&ct=${encodeURIComponent(contentType)}&sig=${sig}`;
    return { url, method: 'PUT', headers: { 'Content-Type': contentType }, expiresAt: new Date(exp) };
  }

  async presignDownload(bucket: string, key: string, ttlSeconds: number, filename?: string): Promise<string> {
    const exp = Date.now() + ttlSeconds * 1000;
    const sig = this.sign(['download', bucket, key, String(exp)]);
    return `${this.env.API_URL}/${this.env.API_GLOBAL_PREFIX}/v1/uploads/local/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}?exp=${exp}&sig=${sig}${filename ? `&fn=${encodeURIComponent(filename)}` : ''}`;
  }

  publicUrl(bucket: string, key: string): string {
    return `${this.env.API_URL}/${this.env.API_GLOBAL_PREFIX}/v1/uploads/public/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async putObject(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
    const p = this.safePath(bucket, key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, body);
    await fs.writeFile(p + '.meta.json', JSON.stringify({ contentType, size: body.length }));
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    return fs.readFile(this.safePath(bucket, key));
  }

  async head(bucket: string, key: string): Promise<StorageObjectInfo | null> {
    try {
      const p = this.safePath(bucket, key);
      const stat = await fs.stat(p);
      let contentType: string | undefined;
      try {
        contentType = (JSON.parse(await fs.readFile(p + '.meta.json', 'utf8')) as { contentType?: string }).contentType;
      } catch {
        /* no meta */
      }
      return { key, size: stat.size, contentType };
    } catch {
      return null;
    }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    const p = this.safePath(bucket, key);
    await Promise.allSettled([fs.unlink(p), fs.unlink(p + '.meta.json')]);
  }

  async isHealthy(): Promise<boolean> {
    try {
      await fs.mkdir(this.root, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }
}
