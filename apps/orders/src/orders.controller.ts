import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { CurrentUser, JwtAuthGuard, Roles, User } from '@app/common';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.create(createOrderDto, user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() query: QueryOrdersDto, @CurrentUser() user: User) {
    return this.ordersService.findAll(query, user);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard)
  @Roles('Admin')
  async findAllAdmin(@Query() query: QueryOrdersDto) {
    return this.ordersService.findAllAdmin(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ordersService.findOne(+id, user);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ordersService.cancel(+id, user);
  }

  @Post(':id/checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(
    @Param('id') id: string,
    @Body() checkoutDto: CheckoutDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.checkout(+id, checkoutDto, user);
  }
}
