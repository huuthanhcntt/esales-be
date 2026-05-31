import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '@app/common';

describe('MediaController', () => {
  let controller: MediaController;
  let service: MediaService;

  const mockMediaService = {
    upload: jest.fn().mockResolvedValue({ key: 'test.jpg', url: 'https://signed-url' }),
    getSignedUrl: jest.fn().mockResolvedValue('https://signed-url'),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [{ provide: MediaService, useValue: mockMediaService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MediaController>(MediaController);
    service = module.get<MediaService>(MediaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upload', () => {
    it('should call mediaService.upload with file and folder', async () => {
      const file = { originalname: 'test.jpg' } as Express.Multer.File;
      await controller.upload(file, { folder: 'products' });
      expect(service.upload).toHaveBeenCalledWith(file, 'products');
    });
  });

  describe('getUrl', () => {
    it('should return key and signed url', async () => {
      const result = await controller.getUrl('products/test.jpg');
      expect(result).toEqual({ key: 'products/test.jpg', url: 'https://signed-url' });
    });
  });

  describe('delete', () => {
    it('should call mediaService.delete and return confirmation', async () => {
      const result = await controller.delete('test.jpg');
      expect(service.delete).toHaveBeenCalledWith('test.jpg');
      expect(result).toEqual({ deleted: true, key: 'test.jpg' });
    });
  });

  describe('rpcUpload', () => {
    it('should call mediaService.upload via RPC', async () => {
      const data = {
        buffer: Buffer.from('test'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 100,
        folder: 'products',
      };
      await controller.rpcUpload(data);
      expect(service.upload).toHaveBeenCalled();
    });
  });

  describe('rpcDelete', () => {
    it('should delete via RPC', async () => {
      const result = await controller.rpcDelete({ key: 'test.jpg' });
      expect(result).toEqual({ deleted: true, key: 'test.jpg' });
    });
  });

  describe('rpcGetUrl', () => {
    it('should get URL via RPC', async () => {
      const result = await controller.rpcGetUrl({ key: 'test.jpg' });
      expect(result).toEqual({ key: 'test.jpg', url: 'https://signed-url' });
    });
  });
});
