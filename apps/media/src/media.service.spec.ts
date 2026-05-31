jest.mock('minio', () => ({
  Client: jest.fn().mockImplementation(() => ({
    bucketExists: jest.fn().mockResolvedValue(true),
    makeBucket: jest.fn().mockResolvedValue(undefined),
    putObject: jest.fn().mockResolvedValue({}),
    presignedGetObject: jest.fn().mockResolvedValue('https://signed-url'),
    removeObject: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaService } from './media.service';
import * as Minio from 'minio';

describe('MediaService', () => {
  let service: MediaService;
  let minioClientInstance: jest.Mocked<any>;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        MINIO_ENDPOINT: 'localhost',
        MINIO_PORT: 9000,
        MINIO_USE_SSL: 'false',
        MINIO_ACCESS_KEY: 'minioadmin',
        MINIO_SECRET_KEY: 'minioadmin',
        MINIO_BUCKET: 'esales',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    // Get the mocked Minio.Client instance
    minioClientInstance = (Minio.Client as jest.Mock).mock.results[0].value;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload()', () => {
    const validFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test-image.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('fake-image-data'),
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(service.upload(null as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.upload(null as any)).rejects.toThrow(
        'File is required',
      );
    });

    it('should throw BadRequestException when file size exceeds 10MB', async () => {
      const largeFile = {
        ...validFile,
        size: 11 * 1024 * 1024, // 11MB
      };

      await expect(service.upload(largeFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.upload(largeFile)).rejects.toThrow(
        'File size exceeds maximum of 10MB',
      );
    });

    it('should throw BadRequestException for invalid mime type', async () => {
      const invalidFile = {
        ...validFile,
        mimetype: 'application/zip',
      };

      await expect(service.upload(invalidFile)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.upload(invalidFile)).rejects.toThrow(
        'File type "application/zip" is not allowed',
      );
    });

    it('should upload file to MinIO and return key + url', async () => {
      const result = await service.upload(validFile);

      expect(minioClientInstance.putObject).toHaveBeenCalledWith(
        'esales',
        expect.stringMatching(/^[0-9a-f-]+\.png$/),
        validFile.buffer,
        validFile.size,
        { 'Content-Type': 'image/png' },
      );
      expect(minioClientInstance.presignedGetObject).toHaveBeenCalledWith(
        'esales',
        expect.stringMatching(/^[0-9a-f-]+\.png$/),
        7 * 24 * 3600,
      );
      expect(result).toEqual({
        key: expect.stringMatching(/^[0-9a-f-]+\.png$/),
        url: 'https://signed-url',
      });
    });

    it('should upload with folder prefix when provided', async () => {
      const result = await service.upload(validFile, 'avatars');

      expect(minioClientInstance.putObject).toHaveBeenCalledWith(
        'esales',
        expect.stringMatching(/^avatars\/[0-9a-f-]+\.png$/),
        validFile.buffer,
        validFile.size,
        { 'Content-Type': 'image/png' },
      );
      expect(result.key).toMatch(/^avatars\//);
    });
  });

  describe('getSignedUrl()', () => {
    it('should return presigned URL', async () => {
      const result = await service.getSignedUrl('some-key.png');

      expect(minioClientInstance.presignedGetObject).toHaveBeenCalledWith(
        'esales',
        'some-key.png',
        7 * 24 * 3600,
      );
      expect(result).toBe('https://signed-url');
    });
  });

  describe('delete()', () => {
    it('should remove object from MinIO', async () => {
      await service.delete('some-key.png');

      expect(minioClientInstance.removeObject).toHaveBeenCalledWith(
        'esales',
        'some-key.png',
      );
    });
  });
});
