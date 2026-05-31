import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { CurrentUser, JwtAuthGuard, Roles, User, PRODUCT_PATTERNS } from '@app/common';
import { ProductsGateway } from './products.gateway';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsGateway: ProductsGateway,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: User,
  ) {
    const product = await this.productsService.create(createProductDto, user);
    this.productsGateway.emitProductUpdated(product);
    return product;
  }

  @Get()
  async findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: User,
  ) {
    const product = await this.productsService.update(+id, updateProductDto, user);
    this.productsGateway.emitProductUpdated(product);
    return product;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    const product = await this.productsService.remove(+id, user);
    this.productsGateway.emitProductUpdated({ ...product, deleted: true });
    return product;
  }

  // Inter-service message patterns
  @MessagePattern(PRODUCT_PATTERNS.GET)
  async getProduct(@Payload() data: { id: number }) {
    return this.productsService.getProduct(data.id);
  }

  @MessagePattern(PRODUCT_PATTERNS.CHECK_STOCK)
  async checkStock(@Payload() data: { id: number }) {
    return this.productsService.checkStock(data.id);
  }

  @MessagePattern(PRODUCT_PATTERNS.MARK_SOLD)
  async markSold(@Payload() data: { id: number }) {
    return this.productsService.markSold(data.id);
  }
}
