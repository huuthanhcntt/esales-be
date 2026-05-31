import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: PaymentsService;

  const mockPaymentsService = {
    createCharge: jest.fn().mockResolvedValue({
      id: 'pi_stub_123',
      amount: 10000,
      status: 'succeeded',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createCharge', () => {
    it('should call paymentsService.createCharge with data', async () => {
      const dto = {
        card: { number: '4242', exp_month: 12, exp_year: 2030, cvc: '123' },
        amount: 100,
        email: 'test@test.com',
      };
      await controller.createCharge(dto as any);
      expect(service.createCharge).toHaveBeenCalledWith(dto);
    });
  });
});
