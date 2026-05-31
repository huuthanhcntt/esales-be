import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createCategoryDto: CreateCategoryDto) {
    return this.prismaService.category.create({
      data: createCategoryDto,
      include: { parent: true },
    });
  }

  async findAll() {
    return this.prismaService.category.findMany({
      include: {
        children: true,
        _count: { select: { products: true } },
      },
      where: { parentId: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const category = await this.prismaService.category.findUnique({
      where: { id },
      include: { children: true, products: true },
    });
    if (!category) throw new NotFoundException(`Category #${id} not found`);
    return category;
  }
}
