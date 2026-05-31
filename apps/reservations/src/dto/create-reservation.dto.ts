import { Type } from 'class-transformer';
import {
  IsDate,
  IsDefined,
  IsNotEmptyObject,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateChargeDto } from '@app/common';

export class CreateReservationDto {
  @ApiProperty({ example: '2026-06-01T00:00:00.000Z' })
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty({ example: '2026-06-05T00:00:00.000Z' })
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @ApiProperty({
    example: {
      amount: 100,
      card: {
        cvc: '413',
        exp_month: 12,
        exp_year: 2027,
        number: '4242424242424242',
      },
    },
  })
  @IsDefined()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CreateChargeDto)
  charge: CreateChargeDto;
}
