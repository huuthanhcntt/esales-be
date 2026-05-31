import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: {
    category: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  const mockCategory = {
    id: 1,
    name: 'Electronics',
    parentId: null,
    parent: null,
    children: [],
    products: [],
  };

  const mockChildCategory = {
    id: 2,
    name: 'Smartphones',
    parentId: 1,
    parent: { id: 1, name: 'Electronics' },
    children: [],
    products: [],
  };

  beforeEach(async () => {
    prisma = {
      category: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a category', async () => {
      const createDto = { name: 'Electronics' };
      prisma.category.create.mockResolvedValue(mockCategory);

      const result = await service.create(createDto);

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: createDto,
        include: { parent: true },
      });
      expect(result).toEqual(mockCategory);
    });

    it('should create a child category with parentId', async () => {
      const createDto = { name: 'Smartphones', parentId: 1 };
      prisma.category.create.mockResolvedValue(mockChildCategory);

      const result = await service.create(createDto);

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: createDto,
        include: { parent: true },
      });
      expect(result.parentId).toBe(1);
    });
  });

  describe('findAll', () => {
    it('should return root categories as a tree', async () => {
      const rootCategories = [
        {
          ...mockCategory,
          children: [{ id: 2, name: 'Smartphones', parentId: 1 }],
          _count: { products: 5 },
        },
      ];
      prisma.category.findMany.mockResolvedValue(rootCategories);

      const result = await service.findAll();

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        include: {
          children: true,
          _count: { select: { products: true } },
        },
        where: { parentId: null },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(rootCategories);
    });

    it('should return empty array when no categories exist', async () => {
      prisma.category.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a category by id', async () => {
      prisma.category.findUnique.mockResolvedValue(mockCategory);

      const result = await service.findOne(1);

      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { children: true, products: true },
      });
      expect(result).toEqual(mockCategory);
    });

    it('should throw NotFoundException when category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow(
        'Category #999 not found',
      );
    });
  });
});
