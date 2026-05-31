jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import * as nodemailer from 'nodemailer';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockSendMail: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          SMTP_HOST: 'localhost',
          SMTP_PORT: 1025,
          SMTP_USER: 'noreply@esales.local',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    mockSendMail = (nodemailer.createTransport as jest.Mock).mock.results[0]
      .value.sendMail;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('notifyEmail()', () => {
    it('should call transporter.sendMail with correct from/to/subject/text', async () => {
      const dto = {
        email: 'user@example.com',
        text: 'Your order has been confirmed.',
      };

      await service.notifyEmail(dto);

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'noreply@esales.local',
        to: 'user@example.com',
        subject: 'eSales Notification',
        text: 'Your order has been confirmed.',
      });
    });

    it('should use the email from dto as recipient', async () => {
      const dto = {
        email: 'another@example.com',
        text: 'Payment received.',
      };

      await service.notifyEmail(dto);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'another@example.com',
          text: 'Payment received.',
        }),
      );
    });
  });
});
