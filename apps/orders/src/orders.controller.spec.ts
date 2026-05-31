import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '@app/common';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: jest.Mocked<OrdersService>;

  const mockUser = { id: 1, email: 'test@example.com', password: 'hashed' };

  const mockOrder = {
    id: 1,
    userId: 1,
    orderNumber: 'ORD-001',
    totalAmount: 500000,
    currency: 'VND',
    status: 'PENDING',
    items: [],
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn().mockResolvedValue(mockOrder),
      findAll: jest.fn().mockResolvedValue({
        data: [mockOrder],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      }),
      findAllAdmin: jest.fn().mockResolvedValue({
        data: [mockOrder],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      }),
      findOne: jest.fn().mockResolvedValue(mockOrder),
      cancel: jest.fn().mockResolvedValue({ ...mockOrder, status: 'CANCELLED' }),
      checkout: jest.fn().mockResolvedValue(mockOrder),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get(OrdersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create()', () => {
    it('should call service.create with dto and user', async () => {
      const dto = {
        items: [{ productId: 10, quantity: 2, unitPrice: 250000 }],
      };

      const result = await controller.create(dto, mockUser);

      expect(service.create).toHaveBeenCalledWith(dto, mockUser);
      expect(result).toEqual(mockOrder);
    });
  });

  describe('findAll()', () => {
    it('should call service.findAll with query and user', async () => {
      const query = { page: 1, limit: 20 };

      const result = await controller.findAll(query, mockUser);

      expect(service.findAll).toHaveBeenCalledWith(query, mockUser);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne()', () => {
    it('should call service.findOne with id and user', async () => {
      const result = await controller.findOne('1', mockUser);

      expect(service.findOne).toHaveBeenCalledWith(1, mockUser);
      expect(result).toEqual(mockOrder);
    });
  });

  describe('cancel()', () => {
    it('should call service.cancel with id and user', async () => {
      const result = await controller.cancel('1', mockUser);

      expect(service.cancel).toHaveBeenCalledWith(1, mockUser);
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('findAllAdmin()', () => {
    it('should call service.findAllAdmin with query', async () => {
      const query = { page: 1, limit: 20 };

      const result = await controller.findAllAdmin(query);

      expect(service.findAllAdmin).toHaveBeenCalledWith(query);
      expect(result.data).toHaveLength(1);
    });
  });
});
