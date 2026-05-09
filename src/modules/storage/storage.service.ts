import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import * as path from 'path';

export type StorageUploadResult = {
  url: string;
  objectPath: string;
  bucket: string;
};

export type StorageUploadOptions = {
  buffer: Buffer;
  originalFilename?: string;
  mimeType?: string;
  directory?: string | Array<string | number | null | undefined>;
  prefix?: string;
  makePublic?: boolean;
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly uploadPrefix: string;

  constructor(private readonly configService: ConfigService) {
    const keyRelative = this.configService.get<string>('GCP_STORAGE_KEY_FILENAME');

    let keyFilenamePath: string | undefined;
    if (keyRelative) {
      keyFilenamePath = path.isAbsolute(keyRelative) ? keyRelative : path.join(process.cwd(), keyRelative);
      if (!fs.existsSync(keyFilenamePath)) {
        this.logger.warn(`GCP key file not found at ${keyFilenamePath}; falling back to ADC / env credentials`);
        keyFilenamePath = undefined;
      }
    }

    this.storage = keyFilenamePath != null ? new Storage({ keyFilename: keyFilenamePath }) : new Storage();
    this.bucketName = this.configService.get<string>('GCP_STORAGE_BUCKET')?.trim() || 'stack-auto-storage';

    const rawPrefix = this.configService.get<string>('GCS_UPLOAD_PREFIX') || 'uploads';
    this.uploadPrefix = rawPrefix.replace(/^[/\s]+|[/\s]+$/g, '').replace(/\s+/g, '');
  }

  /**
   * Sanitize original filename for GCS object name (basename, ascii-ish).
   */
  private sanitizeFileBase(originalName: string): string {
    const base = path.basename(originalName || 'file').slice(0, 200);
    return base.replace(/[^\w.\-()+ ]/g, '_').replace(/_+/g, '_') || 'file';
  }

  private sanitizeObjectSegment(segment: string | number): string {
    return String(segment)
      .trim()
      .replace(/^\/+|\/+$/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._=+()-]/g, '_')
      .replace(/_+/g, '_');
  }

  private normalizeDirectory(directory?: StorageUploadOptions['directory']): string {
    const segments = Array.isArray(directory) ? directory : directory?.split('/');
    return (segments || [])
      .filter(
        (segment): segment is string | number =>
          segment !== null && segment !== undefined && String(segment).trim() !== ''
      )
      .map((segment) => this.sanitizeObjectSegment(segment))
      .filter(Boolean)
      .join('/');
  }

  private normalizePrefix(prefix?: string): string {
    const value = prefix ?? this.uploadPrefix;
    return value
      .split('/')
      .map((segment) => this.sanitizeObjectSegment(segment))
      .filter(Boolean)
      .join('/');
  }

  private buildObjectPath(opts: Pick<StorageUploadOptions, 'directory' | 'originalFilename' | 'prefix'>): string {
    const safeBase = this.sanitizeFileBase(opts.originalFilename || 'file');
    const filename = `${randomUUID()}-${safeBase}`;
    const prefix = this.normalizePrefix(opts.prefix);
    const directory = this.normalizeDirectory(opts.directory);

    return [prefix, directory, filename].filter(Boolean).join('/');
  }

  private buildPublicUrl(objectPath: string): string {
    const encodedSegments = objectPath.split('/').map((s) => encodeURIComponent(s));
    return `https://storage.googleapis.com/${this.bucketName}/${encodedSegments.join('/')}`;
  }

  async uploadFile(opts: StorageUploadOptions): Promise<StorageUploadResult> {
    const { buffer, mimeType, makePublic = true } = opts;
    const objectPath = this.buildObjectPath(opts);

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(objectPath);

    await new Promise<void>((resolve, reject) => {
      const stream = file.createWriteStream({
        resumable: buffer.length > 6 * 1024 * 1024,
        contentType: mimeType || undefined,
      });
      stream.on('error', reject);
      stream.on('finish', () => resolve());
      stream.end(buffer);
    });

    if (makePublic) {
      try {
        await file.makePublic();
      } catch (e) {
        this.logger.warn(`makePublic failed for ${objectPath} (bucket may already be uniformly public): ${e}`);
      }
    }

    const url = this.buildPublicUrl(objectPath);
    return { url, objectPath, bucket: this.bucketName };
  }
}
