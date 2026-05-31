import { Test } from '@nestjs/testing';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
    }).compile();

    controller = module.get(HealthController);
  });

  describe('live', () => {
    it('should return status ok', async () => {
      const result = await controller.live();
      expect(result.status).toBe('ok');
      expect(result.details.process.status).toBe('up');
    });
  });

  describe('ready', () => {
    it('should return status ok', async () => {
      const result = await controller.ready();
      expect(result.status).toBe('ok');
      expect(result.details.process.status).toBe('up');
    });
  });

  describe('root', () => {
    it('should return status ok for backward compatibility', async () => {
      const result = await controller.root();
      expect(result.status).toBe('ok');
    });
  });
});
