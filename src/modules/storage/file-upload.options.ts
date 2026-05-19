import { memoryStorage } from 'multer';

export const DEFAULT_MAX_UPLOAD_MB = 15;
export const DEFAULT_ALLOWED_UPLOAD_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
]);

const DEFAULT_ALLOWED_UPLOAD_EXTENSION_PATTERN = /\.(jpe?g|png|gif|webp|svg|pdf|txt|csv|doc|docx|xls|xlsx|zip)$/i;

export function resolveMaxUploadMb(value: unknown, fallback = DEFAULT_MAX_UPLOAD_MB): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function memoryFileUploadOptions(maxMb = DEFAULT_MAX_UPLOAD_MB) {
  return {
    storage: memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024 },
  };
}

export function isAllowedUploadFileType(file: Express.Multer.File): boolean {
  const mimeType = (file.mimetype || '').toLowerCase().split(';')[0].trim();
  if (DEFAULT_ALLOWED_UPLOAD_MIMES.has(mimeType)) return true;

  if (!mimeType || mimeType === 'application/octet-stream') {
    return DEFAULT_ALLOWED_UPLOAD_EXTENSION_PATTERN.test(file.originalname || '');
  }

  return false;
}
