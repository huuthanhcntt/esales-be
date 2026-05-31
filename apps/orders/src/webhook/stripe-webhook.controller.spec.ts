import { Test, TestingModule } from '@nestjs/testing';
import { StripeWebhookController } from './stripe-webhook.controller';
import { OrdersService } from '../orders.service';

describe('StripeWebhookController', () => {
  let controller: StripeWebhookController;
  let service: OrdersService;

  const mockOrdersService = {
    handleStripeWebhook: jest.fn().mockResolvedValue({ received: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();

    controller = module.get<StripeWebhookController>(StripeWebhookController);
    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('should call ordersService.handleStripeWebhook', async () => {
      const payload = { type: 'payment_intent.succeeded' };
      const result = await controller.handleWebhook(payload);
      expect(service.handleStripeWebhook).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ received: true });
    });
  });
});
