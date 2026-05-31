import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductsGateway } from './products.gateway';
import { JwtAuthGuard, User } from '@app/common';

describe('ProductsController', () => {
  let controller: ProductsController;
  let productsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    getProduct: jest.Mock;
    checkStock: jest.Mock;
    markSold: jest.Mock;
  };
  let productsGateway: {
    emitProductUpdated: jest.Mock;
  };

  const mockUser: User = {
    id: 1,
    email: 'user@test.com',
    password: 'hashed',
    roles: ['User'],
  };

  const mockProduct = {
    id: 1,
    name: 'iPhone 15',
    description: 'Latest Apple smartphone',
    price: 29990000,
    currency: 'VND',
    status: 'ACTIVE',
    userId: 1,
    categoryId: 1,
    category: { id: 1, name: 'Electronics' },
    images: [],
  };

  beforeEach(async () => {
    productsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getProduct: jest.fn(),
      checkStock: jest.fn(),
      markSold: jest.fn(),
    };

    productsGateway = {
      emitProductUpdated: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: productsService },
        { provide: ProductsGateway, useValue: productsGateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create and gateway.emitProductUpdated', async () => {
      const createDto = {
        name: 'iPhone 15',
        description: 'Latest Apple smartphone',
        price: 29990000,
      };
      productsService.create.mockResolvedValue(mockProduct);

      const result = await controller.create(createDto, mockUser);

      expect(productsService.create).toHaveBeenCalledWith(createDto, mockUser);
      expect(productsGateway.emitProductUpdated).toHaveBeenCalledWith(
        mockProduct,
      );
      expect(result).toEqual(mockProduct);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with query params', async () => {
      const query = { page: 1, limit: 20, search: 'iPhone' };
      const paginatedResult = {
        data: [mockProduct],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };
      productsService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(query);

      expect(productsService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with parsed id', async () => {
      productsService.findOne.mockResolvedValue(mockProduct);

      const result = await controller.findOne('1');

      expect(productsService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockProduct);
    });
  });

  describe('update', () => {
    it('should call service.update and gateway.emitProductUpdated', async () => {
      const updateDto = { name: 'iPhone 15 Pro' };
      const updatedProduct = { ...mockProduct, ...updateDto };
      productsService.update.mockResolvedValue(updatedProduct);

      const result = await controller.update('1', updateDto, mockUser);

      expect(productsService.update).toHaveBeenCalledWith(
        1,
        updateDto,
        mockUser,
      );
      expect(productsGateway.emitProductUpdated).toHaveBeenCalledWith(
        updatedProduct,
      );
      expect(result).toEqual(updatedProduct);
    });
  });

  describe('remove', () => {
    it('should call service.remove and gateway with deleted flag', async () => {
      const removedProduct = { ...mockProduct, deletedAt: new Date() };
      productsService.remove.mockResolvedValue(removedProduct);

      const result = await controller.remove('1', mockUser);

      expect(productsService.remove).toHaveBeenCalledWith(1, mockUser);
      expect(productsGateway.emitProductUpdated).toHaveBeenCalledWith({
        ...removedProduct,
        deleted: true,
      });
      expect(result).toEqual(removedProduct);
    });
  });
});
