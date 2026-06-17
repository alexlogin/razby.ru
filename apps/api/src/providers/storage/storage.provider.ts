export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface PresignedUpload {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresInSec: number;
}

/** Контракт S3-совместимого хранилища. */
export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<{ key: string; url: string }>;
  getPublicUrl(key: string): string;
  presignUpload(key: string, contentType: string): Promise<PresignedUpload>;
  deleteObject(key: string): Promise<void>;
}
