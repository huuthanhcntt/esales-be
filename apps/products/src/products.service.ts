import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResponse, User } from '@app/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { PrismaService } from './prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createProductDto: CreateProductDto, user: User) {
    try {
      return await this.prismaService.product.create({
        data: {
          ...createProductDto,
          userId: user.id,
        },
        include: { category: true, images: true },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          `A product with SKU "${createProductDto.sku}" already exists`,
        );
      }
      throw error;
    }
  }

  async findAll(query: QueryProductsDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20, search, categoryId, status, minPrice, maxPrice, userId } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    const [data, total] = await Promise.all([
      this.prismaService.product.findMany({
        where,
        skip,
        take: limit,
        include: { category: true, images: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.product.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const product = await this.prismaService.product.findUnique({
      where: { id },
      include: { category: true, images: true },
    });
    if (!product) throw new NotFoundException(`Product #${id} not found`);
    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto, user: User) {
    const product = await this.findOne(id);
    if (product.userId !== user.id && !user.roles?.includes('Admin')) {
      throw new ForbiddenException('You can only update your own products');
    }
    return this.prismaService.product.update({
      where: { id },
      data: updateProductDto,
      include: { category: true, images: true },
    });
  }

  async remove(id: number, user: User) {
    const product = await this.findOne(id);
    if (product.userId !== user.id && !user.roles?.includes('Admin')) {
      throw new ForbiddenException('You can only delete your own products');
    }
    return this.prismaService.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Inter-service RPC handlers
  async getProduct(id: number) {
    return this.findOne(id);
  }

  async checkStock(id: number) {
    const product = await this.findOne(id);
    return {
      id: product.id,
      available: product.status === 'ACTIVE',
      price: product.price,
      currency: product.currency,
    };
  }

  async markSold(id: number) {
    return this.prismaService.product.update({
      where: { id },
      data: { status: 'SOLD' },
    });
  }
}
