import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, map } from 'rxjs';
import {
  PAYMENTS_SERVICE,
  PRODUCTS_SERVICE,
  NOTIFICATIONS_SERVICE,
  PRODUCT_PATTERNS,
  PaginatedResponse,
  User,
} from '@app/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { PrismaService } from './prisma.service';

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject(PAYMENTS_SERVICE) private readonly paymentsClient: ClientProxy,
    @Inject(PRODUCTS_SERVICE) private readonly productsClient: ClientProxy,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsClient: ClientProxy,
  ) {}

  async onModuleInit() {
    // Kafka requires subscribing to reply topics for request-response patterns
    for (const client of [this.paymentsClient, this.productsClient]) {
      if (typeof (client as any).subscribeToResponseOf === 'function') {
        (client as any).subscribeToResponseOf('create_charge');
        (client as any).subscribeToResponseOf(PRODUCT_PATTERNS.GET);
        (client as any).subscribeToResponseOf(PRODUCT_PATTERNS.CHECK_STOCK);
        await client.connect();
      }
    }
  }

  async create(createOrderDto: CreateOrderDto, user: User) {
    // Verify all products exist and are available
    for (const item of createOrderDto.items) {
      const stock = await lastValueFrom(
        this.productsClient.send(PRODUCT_PATTERNS.CHECK_STOCK, {
          id: item.productId,
        }),
      );
      if (!stock.available) {
        throw new ForbiddenException(
          `Product #${item.productId} is not available`,
        );
      }
    }

    const totalAmount = createOrderDto.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    return this.prismaService.order.create({
      data: {
        userId: user.id,
        totalAmount,
        currency: createOrderDto.currency || 'VND',
        notes: createOrderDto.notes,
        shippingAddress: createOrderDto.shippingAddress as any,
        items: {
          create: createOrderDto.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.unitPrice * item.quantity,
          })),
        },
      },
      include: { items: true },
    });
  }

  async findAll(
    query: QueryOrdersDto,
    user: User,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId: user.id };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prismaService.order.findMany({
        where,
        skip,
        take: limit,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.order.count({ where }),
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

  async findAllAdmin(
    query: QueryOrdersDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prismaService.order.findMany({
        where,
        skip,
        take: limit,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.order.count({ where }),
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

  async findOne(id: number, user: User) {
    const order = await this.prismaService.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException(`Order #${id} not found`);
    if (order.userId !== user.id && !user.roles?.includes('Admin')) {
      throw new ForbiddenException('You can only view your own orders');
    }
    return order;
  }

  async cancel(id: number, user: User) {
    const order = await this.findOne(id, user);
    if (!['PENDING', 'PAYMENT_PENDING'].includes(order.status)) {
      throw new ForbiddenException(
        'Only pending orders can be cancelled',
      );
    }
    return this.prismaService.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { items: true },
    });
  }

  async checkout(id: number, checkoutDto: CheckoutDto, user: User) {
    const order = await this.findOne(id, user);
    if (order.status !== 'PENDING') {
      throw new ForbiddenException('Only pending orders can be checked out');
    }

    // Update status to payment pending
    await this.prismaService.order.update({
      where: { id },
      data: { status: 'PAYMENT_PENDING' },
    });

    // Send charge to payments service
    return this.paymentsClient
      .send('create_charge', {
        ...checkoutDto.charge,
        email: user.email,
        amount: order.totalAmount,
      })
      .pipe(
        map(async (chargeResult) => {
          // Update order with payment info
          const updatedOrder = await this.prismaService.order.update({
            where: { id },
            data: {
              status: 'PAID',
              invoiceId: chargeResult.id,
            },
            include: { items: true },
          });

          // Mark products as sold
          for (const item of updatedOrder.items) {
            this.productsClient.emit(PRODUCT_PATTERNS.MARK_SOLD, {
              id: item.productId,
            });
          }

          // Send order confirmation email
          this.notificationsClient.emit('notify_email', {
            email: user.email,
            text: `Your order #${updatedOrder.orderNumber} has been confirmed. Total: ${updatedOrder.totalAmount} ${updatedOrder.currency}`,
          });

          return updatedOrder;
        }),
      );
  }

  async handleStripeWebhook(payload: any) {
    this.logger.log(`Stripe webhook received: ${payload.type}`);

    if (payload.type === 'payment_intent.succeeded') {
      const invoiceId = payload.data?.object?.id;
      if (invoiceId) {
        const order = await this.prismaService.order.findFirst({
          where: { invoiceId },
        });
        if (order && order.status === 'PAYMENT_PENDING') {
          await this.prismaService.order.update({
            where: { id: order.id },
            data: { status: 'PAID' },
          });
        }
      }
    }

    return { received: true };
  }
}
