import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { randomUUID } from 'crypto';
import { extname } from 'path';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private minioClient: Minio.Client;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('MINIO_BUCKET');
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT'),
      port: this.configService.get<number>('MINIO_PORT'),
      useSSL: this.configService.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY'),
    });
  }

  async onModuleInit() {
    const exists = await this.minioClient.bucketExists(this.bucket);
    if (!exists) {
      await this.minioClient.makeBucket(this.bucket);
      this.logger.log(`Bucket "${this.bucket}" created`);
    }
  }

  async upload(
    file: Express.Multer.File,
    folder?: string,
  ): Promise<{ key: string; url: string }> {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed`,
      );
    }

    const ext = extname(file.originalname);
    const key = folder
      ? `${folder}/${randomUUID()}${ext}`
      : `${randomUUID()}${ext}`;

    await this.minioClient.putObject(
      this.bucket,
      key,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    const url = await this.getSignedUrl(key);
    return { key, url };
  }

  async getSignedUrl(key: string): Promise<string> {
    return this.minioClient.presignedGetObject(this.bucket, key, 7 * 24 * 3600);
  }

  async delete(key: string): Promise<void> {
    await this.minioClient.removeObject(this.bucket, key);
  }
}
