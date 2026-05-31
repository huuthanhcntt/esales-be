import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from './prisma.service';
import { User } from '@app/common';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: {
    product: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };

  const mockUser: User = {
    id: 1,
    email: 'user@test.com',
    password: 'hashed',
    roles: ['User'],
  };

  const mockAdminUser: User = {
    id: 2,
    email: 'admin@test.com',
    password: 'hashed',
    roles: ['Admin'],
  };

  const mockOtherUser: User = {
    id: 3,
    email: 'other@test.com',
    password: 'hashed',
    roles: ['User'],
  };

  const mockProduct = {
    id: 1,
    name: 'iPhone 15',
    description: 'Latest Apple smartphone',
    price: 29990000,
    currency: 'VND',
    sku: 'IP15-256',
    status: 'ACTIVE',
    userId: 1,
    categoryId: 1,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    category: { id: 1, name: 'Electronics' },
    images: [],
  };

  beforeEach(async () => {
    prisma = {
      product: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product with userId from user', async () => {
      const createDto = {
        name: 'iPhone 15',
        description: 'Latest Apple smartphone',
        price: 29990000,
        categoryId: 1,
      };
      prisma.product.create.mockResolvedValue({ ...mockProduct, ...createDto });

      const result = await service.create(createDto, mockUser);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          userId: mockUser.id,
        },
        include: { category: true, images: true },
      });
      expect(result.userId).toBe(mockUser.id);
    });
  });

  describe('findAll', () => {
    it('should return paginated results with meta', async () => {
      const products = [mockProduct];
      prisma.product.findMany.mockResolvedValue(products);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual(products);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should use default page=1 and limit=20 when not provided', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({});

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should filter by search term', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ search: 'iPhone' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'iPhone', mode: 'insensitive' } },
              { description: { contains: 'iPhone', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should filter by categoryId', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ categoryId: 1 });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: 1 }),
        }),
      );
    });

    it('should filter by status', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ status: 'ACTIVE' as any });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('should filter by price range', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ minPrice: 1000, maxPrice: 5000 });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            price: { gte: 1000, lte: 5000 },
          }),
        }),
      );
    });

    it('should filter by minPrice only', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ minPrice: 1000 });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            price: { gte: 1000 },
          }),
        }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(45);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne(1);

      expect(result).toEqual(mockProduct);
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { category: true, images: true },
      });
    });

    it('should throw NotFoundException when product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow(
        'Product #999 not found',
      );
    });
  });

  describe('update', () => {
    it('should update a product when user is the owner', async () => {
      const updateDto = { name: 'iPhone 15 Pro' };
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.product.update.mockResolvedValue({
        ...mockProduct,
        ...updateDto,
      });

      const result = await service.update(1, updateDto, mockUser);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateDto,
        include: { category: true, images: true },
      });
      expect(result.name).toBe('iPhone 15 Pro');
    });

    it('should allow admin to update any product', async () => {
      const updateDto = { name: 'Updated by Admin' };
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.product.update.mockResolvedValue({
        ...mockProduct,
        ...updateDto,
      });

      const result = await service.update(1, updateDto, mockAdminUser);

      expect(prisma.product.update).toHaveBeenCalled();
      expect(result.name).toBe('Updated by Admin');
    });

    it('should throw ForbiddenException when non-owner non-admin tries to update', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      await expect(
        service.update(1, { name: 'Hacked' }, mockOtherUser),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.update(1, { name: 'Hacked' }, mockOtherUser),
      ).rejects.toThrow('You can only update your own products');
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.update(999, { name: 'test' }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete a product by setting deletedAt', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.product.update.mockResolvedValue({
        ...mockProduct,
        deletedAt: new Date(),
      });

      const result = await service.remove(1, mockUser);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.deletedAt).toBeDefined();
    });

    it('should allow admin to delete any product', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);
      prisma.product.update.mockResolvedValue({
        ...mockProduct,
        deletedAt: new Date(),
      });

      await service.remove(1, mockAdminUser);

      expect(prisma.product.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when non-owner non-admin tries to delete', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      await expect(service.remove(1, mockOtherUser)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.remove(1, mockOtherUser)).rejects.toThrow(
        'You can only delete your own products',
      );
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.remove(999, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('checkStock', () => {
    it('should return availability info for an active product', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.checkStock(1);

      expect(result).toEqual({
        id: 1,
        available: true,
        price: 29990000,
        currency: 'VND',
      });
    });

    it('should return available=false for a sold product', async () => {
      prisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        status: 'SOLD',
      });

      const result = await service.checkStock(1);

      expect(result.available).toBe(false);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.checkStock(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markSold', () => {
    it('should update product status to SOLD', async () => {
      prisma.product.update.mockResolvedValue({
        ...mockProduct,
        status: 'SOLD',
      });

      const result = await service.markSold(1);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'SOLD' },
      });
      expect(result.status).toBe('SOLD');
    });
  });
});
