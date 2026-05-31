import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmptyObject,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateChargeDto } from '@app/common';

export class CheckoutDto {
  @ApiProperty({ type: CreateChargeDto })
  @IsDefined()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CreateChargeDto)
  charge: CreateChargeDto;
}
