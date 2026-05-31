import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { PAYMENTS_SERVICE, User } from '@app/common';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ClientProxy } from '@nestjs/microservices';
import { map } from 'rxjs';
import { PrismaService } from './prisma.service';

@Injectable()
export class ReservationsService implements OnModuleInit {
  constructor(
    private readonly prismaService: PrismaService,
    @Inject(PAYMENTS_SERVICE) private readonly paymentsService: ClientProxy,
  ) {}

  async onModuleInit() {
    // Kafka requires subscribing to reply topics for request-response patterns
    if (typeof (this.paymentsService as any).subscribeToResponseOf === 'function') {
      (this.paymentsService as any).subscribeToResponseOf('create_charge');
      await this.paymentsService.connect();
    }
  }

  async create(
    createReservationDto: CreateReservationDto,
    { email, id: userId }: User,
  ) {
    return this.paymentsService
      .send('create_charge', {
        ...createReservationDto.charge,
        email,
      })
      .pipe(
        map((res) => {
          return this.prismaService.reservation.create({
            data: {
              startDate: createReservationDto.startDate,
              endDate: createReservationDto.endDate,
              invoiceId: res.id,
              timestamp: new Date(),
              userId,
            },
          });
        }),
      );
  }

  async findAll() {
    return this.prismaService.reservation.findMany({});
  }

  async findOne(id: number) {
    return this.prismaService.reservation.findUniqueOrThrow({ where: { id } });
  }

  async update(id: number, updateReservationDto: UpdateReservationDto) {
    return this.prismaService.reservation.update({
      where: { id },
      data: updateReservationDto,
    });
  }

  async remove(id: number) {
    return this.prismaService.reservation.delete({ where: { id } });
  }
}
