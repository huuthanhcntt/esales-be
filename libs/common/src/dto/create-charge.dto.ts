import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmptyObject,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CardDto } from './card.dto';

export class CreateChargeDto {
  @ApiProperty({ type: CardDto })
  @IsDefined()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CardDto)
  card: CardDto;

  @ApiProperty({ example: 100 })
  @IsNumber()
  amount: number;
}
