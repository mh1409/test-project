import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '@souq/config';
import type { PresignedUpload, StorageObjectInfo, StorageProvider } from './storage.provider';

export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly client: S3Client;

  constructor(private readonly env: Env) {
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    });
  }

  async presignUpload(bucket: string, key: string, contentType: string, maxBytes: number, ttlSeconds: number): Promise<PresignedUpload> {
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: undefined });
    const url = await getSignedUrl(this.client, cmd, { expiresIn: ttlSeconds, signableHeaders: new Set(['content-type']) });
    return { url, method: 'PUT', headers: { 'Content-Type': contentType, 'X-Max-Bytes': String(maxBytes) }, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
  }

  async presignDownload(bucket: string, key: string, ttlSeconds: number, filename?: string): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: filename ? `attachment; filename="${encodeURIComponent(filename)}"` : undefined,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: ttlSeconds });
  }

  publicUrl(bucket: string, key: string): string {
    if (this.env.S3_PUBLIC_BASE_URL) return `${this.env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
    return `${this.env.S3_ENDPOINT.replace(/\/$/, '')}/${bucket}/${key}`;
  }

  async putObject(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    return Buffer.from(bytes ?? []);
  }

  async head(bucket: string, key: string): Promise<StorageObjectInfo | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { key, size: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch {
      return null;
    }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.send(new ListBucketsCommand({}));
      return true;
    } catch {
      return false;
    }
  }
}
