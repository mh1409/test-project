export interface PresignedUpload {
  url: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
  fields?: Record<string, string>;
  expiresAt: Date;
}

export interface StorageObjectInfo {
  key: string;
  size: number;
  contentType?: string;
}

export interface StorageProvider {
  readonly name: string;
  presignUpload(bucket: string, key: string, contentType: string, maxBytes: number, ttlSeconds: number): Promise<PresignedUpload>;
  presignDownload(bucket: string, key: string, ttlSeconds: number, filename?: string): Promise<string>;
  publicUrl(bucket: string, key: string): string;
  putObject(bucket: string, key: string, body: Buffer, contentType: string): Promise<void>;
  getObject(bucket: string, key: string): Promise<Buffer>;
  head(bucket: string, key: string): Promise<StorageObjectInfo | null>;
  deleteObject(bucket: string, key: string): Promise<void>;
  isHealthy(): Promise<boolean>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface VirusScanner {
  readonly name: string;
  scan(bytes: Buffer, filename: string): Promise<{ clean: boolean; signature?: string }>;
}
export const VIRUS_SCANNER = Symbol('VIRUS_SCANNER');

export const ALLOWED_IMAGE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/avif': ['avif'],
  'image/gif': ['gif'],
};
export const ALLOWED_VIDEO_TYPES: Record<string, string[]> = { 'video/mp4': ['mp4'], 'video/webm': ['webm'] };
export const ALLOWED_DOCUMENT_TYPES: Record<string, string[]> = { 'application/pdf': ['pdf'] };
