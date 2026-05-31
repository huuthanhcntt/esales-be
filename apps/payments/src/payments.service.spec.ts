import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { NOTIFICATIONS_SERVICE } from '@app/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let notificationsClient: jest.Mocked<any>;

  beforeEach(async () => {
    notificationsClient = {
      emit: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          STRIPE_STUB: 'true',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: NOTIFICATIONS_SERVICE, useValue: notificationsClient },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCharge()', () => {
    const chargeDto = {
      card: { number: '4242424242424242', exp_month: 12, exp_year: 2027, cvc: '123' },
      amount: 50,
      email: 'customer@example.com',
    };

    it('should return a fake payment intent in stub mode', async () => {
      const result = await service.createCharge(chargeDto);

      expect(result.id).toMatch(/^pi_stub_/);
      expect(result.status).toBe('succeeded');
      expect(result.currency).toBe('usd');
      expect(result.payment_method).toMatch(/^pm_stub_/);
    });

    it('should include correct amount in stub result', async () => {
      const result = await service.createCharge(chargeDto);

      expect(result.amount).toBe(5000); // 50 * 100
    });

    it('should emit notify_email event', async () => {
      await service.createCharge(chargeDto);

      expect(notificationsClient.emit).toHaveBeenCalledWith('notify_email', {
        email: 'customer@example.com',
        text: 'Your payment of $50 has completed successfully.',
      });
    });

    it('should include correct email in notification', async () => {
      const customDto = { ...chargeDto, email: 'vip@example.com', amount: 100 };
      await service.createCharge(customDto);

      expect(notificationsClient.emit).toHaveBeenCalledWith('notify_email', {
        email: 'vip@example.com',
        text: 'Your payment of $100 has completed successfully.',
      });
    });
  });
});
