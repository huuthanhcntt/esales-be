import { ProductsGateway } from './products.gateway';

describe('ProductsGateway', () => {
  let gateway: ProductsGateway;

  beforeEach(() => {
    gateway = new ProductsGateway();
    (gateway as any).server = { emit: jest.fn() };
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should log on client connection', () => {
    const logSpy = jest.spyOn((gateway as any).logger, 'log').mockImplementation();
    gateway.handleConnection({ id: 'client-1' } as any);
    expect(logSpy).toHaveBeenCalledWith('Client connected: client-1');
  });

  it('should log on client disconnect', () => {
    const logSpy = jest.spyOn((gateway as any).logger, 'log').mockImplementation();
    gateway.handleDisconnect({ id: 'client-1' } as any);
    expect(logSpy).toHaveBeenCalledWith('Client disconnected: client-1');
  });

  it('should emit productUpdated event', () => {
    const product = { id: 1, name: 'Test' };
    gateway.emitProductUpdated(product);
    expect((gateway as any).server.emit).toHaveBeenCalledWith(
      'productUpdated',
      product,
    );
  });
});
