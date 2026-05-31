import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { createServiceClient, createMicroserviceOptions } from './transport.helper';

describe('Transport Helper', () => {
  let configService: ConfigService;
  const configMap = new Map<string, any>();

  beforeEach(() => {
    configMap.clear();
    configService = {
      get: jest.fn((key: string) => configMap.get(key)),
    } as any;
  });

  describe('createServiceClient', () => {
    it('should return TCP config when KAFKA_BROKER is not set', () => {
      configMap.set('AUTH_HOST', 'auth');
      configMap.set('AUTH_PORT', 3002);

      const result = createServiceClient('auth', configService, 'AUTH_HOST', 'AUTH_PORT');

      expect(result).toEqual({
        transport: Transport.TCP,
        options: {
          host: 'auth',
          port: 3002,
        },
      });
    });

    it('should return Kafka config when KAFKA_BROKER is set', () => {
      configMap.set('KAFKA_BROKER', 'kafka:9092');

      const result = createServiceClient('payments', configService, 'PAYMENTS_HOST', 'PAYMENTS_PORT');

      expect(result).toEqual(
        expect.objectContaining({
          transport: Transport.KAFKA,
          options: expect.objectContaining({
            client: {
              clientId: 'payments-client',
              brokers: ['kafka:9092'],
            },
            consumer: {
              groupId: 'payments-consumer',
            },
          }),
        }),
      );
    });

    it('should use the correct service name in Kafka client/consumer IDs', () => {
      configMap.set('KAFKA_BROKER', 'localhost:9092');

      const result = createServiceClient('notifications', configService, 'HOST', 'PORT') as any;

      expect(result.options.client.clientId).toBe('notifications-client');
      expect(result.options.consumer.groupId).toBe('notifications-consumer');
    });
  });

  describe('createMicroserviceOptions', () => {
    it('should return TCP server config when KAFKA_BROKER is not set', () => {
      configMap.set('PORT', 3003);

      const result = createMicroserviceOptions('payments', configService, 'PORT');

      expect(result).toEqual({
        transport: Transport.TCP,
        options: {
          host: '0.0.0.0',
          port: 3003,
        },
      });
    });

    it('should bind TCP to 0.0.0.0 (all interfaces)', () => {
      configMap.set('PORT', 3004);

      const result = createMicroserviceOptions('notifications', configService, 'PORT');

      expect(result.options.host).toBe('0.0.0.0');
    });

    it('should return Kafka server config when KAFKA_BROKER is set', () => {
      configMap.set('KAFKA_BROKER', 'kafka:9092');

      const result = createMicroserviceOptions('auth', configService, 'TCP_PORT');

      expect(result).toEqual({
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'auth-server',
            brokers: ['kafka:9092'],
          },
          consumer: {
            groupId: 'auth-server-group',
          },
        },
      });
    });

    it('should use -server suffix for Kafka server clientId', () => {
      configMap.set('KAFKA_BROKER', 'kafka:9092');

      const result = createMicroserviceOptions('payments', configService, 'PORT');

      expect(result.options.client.clientId).toBe('payments-server');
      expect(result.options.consumer.groupId).toBe('payments-server-group');
    });
  });
});
