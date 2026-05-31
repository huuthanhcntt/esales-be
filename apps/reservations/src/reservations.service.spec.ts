import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsService } from './reservations.service';
import { PrismaService } from './prisma.service';
import { PAYMENTS_SERVICE } from '@app/common';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let prismaService: {
    reservation: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let paymentsService: { send: jest.Mock; emit: jest.Mock };

  beforeEach(async () => {
    prismaService = {
      reservation: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    paymentsService = {
      send: jest.fn(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prismaService },
        { provide: PAYMENTS_SERVICE, useValue: paymentsService },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all reservations', async () => {
      const reservations = [
        { id: 1, startDate: new Date(), endDate: new Date(), userId: 1 },
        { id: 2, startDate: new Date(), endDate: new Date(), userId: 2 },
      ];

      prismaService.reservation.findMany.mockResolvedValue(reservations);

      const result = await service.findAll();

      expect(prismaService.reservation.findMany).toHaveBeenCalledWith({});
      expect(result).toEqual(reservations);
    });
  });

  describe('findOne', () => {
    it('should return a reservation by id', async () => {
      const reservation = {
        id: 1,
        startDate: new Date(),
        endDate: new Date(),
        userId: 1,
      };

      prismaService.reservation.findUniqueOrThrow.mockResolvedValue(
        reservation,
      );

      const result = await service.findOne(1);

      expect(
        prismaService.reservation.findUniqueOrThrow,
      ).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(reservation);
    });
  });

  describe('update', () => {
    it('should update a reservation', async () => {
      const updateDto = { startDate: new Date('2026-07-01') };
      const updatedReservation = {
        id: 1,
        startDate: updateDto.startDate,
        endDate: new Date(),
        userId: 1,
      };

      prismaService.reservation.update.mockResolvedValue(updatedReservation);

      const result = await service.update(1, updateDto as any);

      expect(prismaService.reservation.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateDto,
      });
      expect(result).toEqual(updatedReservation);
    });
  });

  describe('remove', () => {
    it('should delete a reservation', async () => {
      const reservation = {
        id: 1,
        startDate: new Date(),
        endDate: new Date(),
        userId: 1,
      };

      prismaService.reservation.delete.mockResolvedValue(reservation);

      const result = await service.remove(1);

      expect(prismaService.reservation.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(reservation);
    });
  });
});
