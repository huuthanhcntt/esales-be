import { ClientProvider, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

/**
 * Creates a microservice client config that uses Kafka when KAFKA_BROKER is set,
 * otherwise falls back to TCP for simple local development.
 */
export function createServiceClient(
  serviceName: string,
  configService: ConfigService,
  tcpHostEnv: string,
  tcpPortEnv: string,
): ClientProvider {
  const kafkaBroker = configService.get<string>('KAFKA_BROKER');
  // Each caller needs a unique consumer group for Kafka request-response,
  // otherwise reply messages are consumed by only one service in the group.
  const callerName = configService.get<string>('SERVICE_NAME') || `svc-${process.pid}`;

  if (kafkaBroker) {
    return {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: `${serviceName}-client`,
          brokers: [kafkaBroker],
        },
        consumer: {
          groupId: `${serviceName}-consumer-${callerName}`,
        },
      },
    } as any;
  }

  return {
    transport: Transport.TCP,
    options: {
      host: configService.get(tcpHostEnv),
      port: configService.get(tcpPortEnv),
    },
  } as any;
}

/**
 * Creates a microservice server config for incoming connections.
 * Uses Kafka when KAFKA_BROKER is set, otherwise TCP.
 */
export function createMicroserviceOptions(
  serviceName: string,
  configService: ConfigService,
  tcpPort: string,
) {
  const kafkaBroker = configService.get<string>('KAFKA_BROKER');

  if (kafkaBroker) {
    return {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: `${serviceName}-server`,
          brokers: [kafkaBroker],
        },
        consumer: {
          groupId: `${serviceName}-server-group`,
        },
      },
    };
  }

  return {
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: configService.get(tcpPort),
    },
  };
}
