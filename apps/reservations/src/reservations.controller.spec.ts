import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { JwtAuthGuard } from '@app/common';

describe('ReservationsController', () => {
  let controller: ReservationsController;
  let reservationsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    reservationsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [
        { provide: ReservationsService, useValue: reservationsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReservationsController>(ReservationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should call service.findAll', async () => {
      const reservations = [{ id: 1 }, { id: 2 }];
      reservationsService.findAll.mockResolvedValue(reservations);

      const result = await controller.findAll();

      expect(reservationsService.findAll).toHaveBeenCalled();
      expect(result).toEqual(reservations);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with parsed id', async () => {
      const reservation = { id: 1, startDate: new Date() };
      reservationsService.findOne.mockResolvedValue(reservation);

      const result = await controller.findOne('1');

      expect(reservationsService.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(reservation);
    });
  });

  describe('create', () => {
    it('should call service.create with dto and user', async () => {
      const dto = {
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-05'),
        charge: { amount: 100, card: {} },
      };
      const user = { id: 1, email: 'test@example.com', password: 'hashed' };
      const created = { id: 1, ...dto, userId: user.id };

      reservationsService.create.mockResolvedValue(created);

      const result = await controller.create(dto as any, user as any);

      expect(reservationsService.create).toHaveBeenCalledWith(dto, user);
      expect(result).toEqual(created);
    });
  });

  describe('update', () => {
    it('should call service.update with parsed id and dto', async () => {
      const dto = { startDate: new Date('2026-07-01') };
      const updated = { id: 5, ...dto };

      reservationsService.update.mockResolvedValue(updated);

      const result = await controller.update('5', dto as any);

      expect(reservationsService.update).toHaveBeenCalledWith(5, dto);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should call service.remove with parsed id', async () => {
      const removed = { id: 3 };
      reservationsService.remove.mockResolvedValue(removed);

      const result = await controller.remove('3');

      expect(reservationsService.remove).toHaveBeenCalledWith(3);
      expect(result).toEqual(removed);
    });
  });
});
