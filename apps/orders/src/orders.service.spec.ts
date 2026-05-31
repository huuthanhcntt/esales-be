import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { of } from 'rxjs';
import { OrdersService } from './orders.service';
import { PrismaService } from './prisma.service';
import {
  PAYMENTS_SERVICE,
  PRODUCTS_SERVICE,
  NOTIFICATIONS_SERVICE,
  PRODUCT_PATTERNS,
} from '@app/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: jest.Mocked<any>;
  let paymentsClient: jest.Mocked<any>;
  let productsClient: jest.Mocked<any>;
  let notificationsClient: jest.Mocked<any>;

  const mockUser = { id: 1, email: 'test@example.com', password: 'hashed' };

  const mockOrder = {
    id: 1,
    userId: 1,
    orderNumber: 'ORD-001',
    totalAmount: 500000,
    currency: 'VND',
    status: 'PENDING',
    notes: null,
    shippingAddress: null,
    invoiceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 1,
        orderId: 1,
        productId: 10,
        quantity: 2,
        unitPrice: 250000,
        total: 500000,
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      order: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    paymentsClient = {
      send: jest.fn().mockReturnValue(of({})),
      emit: jest.fn(),
      connect: jest.fn(),
      subscribeToResponseOf: jest.fn(),
    };

    productsClient = {
      send: jest.fn().mockReturnValue(of({ available: true })),
      emit: jest.fn(),
      connect: jest.fn(),
      subscribeToResponseOf: jest.fn(),
    };

    notificationsClient = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PAYMENTS_SERVICE, useValue: paymentsClient },
        { provide: PRODUCTS_SERVICE, useValue: productsClient },
        { provide: NOTIFICATIONS_SERVICE, useValue: notificationsClient },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create()', () => {
    const createOrderDto = {
      items: [
        { productId: 10, quantity: 2, unitPrice: 250000 },
      ],
      currency: 'VND',
      notes: 'Test order',
      shippingAddress: { street: '123 Main', city: 'HCM' },
    };

    it('should validate product stock via RPC, create order with items and totalAmount', async () => {
      productsClient.send.mockReturnValue(of({ available: true }));
      prisma.order.create.mockResolvedValue(mockOrder);

      const result = await service.create(createOrderDto, mockUser);

      expect(productsClient.send).toHaveBeenCalledWith(
        PRODUCT_PATTERNS.CHECK_STOCK,
        { id: 10 },
      );
      expect(prisma.order.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          totalAmount: 500000,
          currency: 'VND',
          notes: 'Test order',
          shippingAddress: { street: '123 Main', city: 'HCM' },
          items: {
            create: [
              {
                productId: 10,
                quantity: 2,
                unitPrice: 250000,
                total: 500000,
              },
            ],
          },
        },
        include: { items: true },
      });
      expect(result).toEqual(mockOrder);
    });

    it('should throw ForbiddenException when product is unavailable', async () => {
      productsClient.send.mockReturnValue(of({ available: false }));

      await expect(service.create(createOrderDto, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(createOrderDto, mockUser)).rejects.toThrow(
        'Product #10 is not available',
      );
      expect(prisma.order.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll()', () => {
    it('should return paginated user orders', async () => {
      const orders = [mockOrder];
      prisma.order.findMany.mockResolvedValue(orders);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 }, mockUser);

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        skip: 0,
        take: 20,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.order.count).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      });
      expect(result).toEqual({
        data: orders,
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('should filter by status when provided', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll(
        { page: 1, limit: 10, status: 'PAID' as any },
        mockUser,
      );

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id, status: 'PAID' },
        }),
      );
    });
  });

  describe('findOne()', () => {
    it('should return an order when found and user is owner', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.findOne(1, mockUser);

      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { items: true },
      });
      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999, mockUser)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(999, mockUser)).rejects.toThrow(
        'Order #999 not found',
      );
    });

    it('should throw ForbiddenException when user is not the owner', async () => {
      prisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        userId: 999,
      });

      await expect(service.findOne(1, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.findOne(1, mockUser)).rejects.toThrow(
        'You can only view your own orders',
      );
    });

    it('should allow Admin to view any order', async () => {
      const adminUser = { ...mockUser, id: 99, roles: ['Admin'] };
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.findOne(1, adminUser);

      expect(result).toEqual(mockOrder);
    });
  });

  describe('cancel()', () => {
    it('should cancel a pending order', async () => {
      const pendingOrder = { ...mockOrder, status: 'PENDING' };
      prisma.order.findUnique.mockResolvedValue(pendingOrder);
      const cancelledOrder = { ...pendingOrder, status: 'CANCELLED' };
      prisma.order.update.mockResolvedValue(cancelledOrder);

      const result = await service.cancel(1, mockUser);

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'CANCELLED' },
        include: { items: true },
      });
      expect(result.status).toBe('CANCELLED');
    });

    it('should cancel a PAYMENT_PENDING order', async () => {
      const paymentPendingOrder = {
        ...mockOrder,
        status: 'PAYMENT_PENDING',
      };
      prisma.order.findUnique.mockResolvedValue(paymentPendingOrder);
      prisma.order.update.mockResolvedValue({
        ...paymentPendingOrder,
        status: 'CANCELLED',
      });

      const result = await service.cancel(1, mockUser);

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw ForbiddenException for non-pending orders', async () => {
      const paidOrder = { ...mockOrder, status: 'PAID' };
      prisma.order.findUnique.mockResolvedValue(paidOrder);

      await expect(service.cancel(1, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.cancel(1, mockUser)).rejects.toThrow(
        'Only pending orders can be cancelled',
      );
    });
  });

  describe('handleStripeWebhook()', () => {
    it('should update order status on payment_intent.succeeded', async () => {
      const order = {
        id: 5,
        status: 'PAYMENT_PENDING',
        invoiceId: 'pi_123',
      };
      prisma.order.findFirst.mockResolvedValue(order);
      prisma.order.update.mockResolvedValue({
        ...order,
        status: 'PAID',
      });

      const result = await service.handleStripeWebhook({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      });

      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: { invoiceId: 'pi_123' },
      });
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { status: 'PAID' },
      });
      expect(result).toEqual({ received: true });
    });

    it('should not update order if already paid', async () => {
      prisma.order.findFirst.mockResolvedValue({
        id: 5,
        status: 'PAID',
        invoiceId: 'pi_123',
      });

      const result = await service.handleStripeWebhook({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      });

      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });

    it('should ignore non-payment_intent.succeeded events', async () => {
      const result = await service.handleStripeWebhook({
        type: 'charge.failed',
        data: {},
      });

      expect(prisma.order.findFirst).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });
  });
});
