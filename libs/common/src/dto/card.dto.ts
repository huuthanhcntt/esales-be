import { IsCreditCard, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CardDto {
  @ApiProperty({ example: '413' })
  @IsString()
  @IsNotEmpty()
  cvc: string;

  @ApiProperty({ example: 12 })
  @IsNumber()
  exp_month: number;

  @ApiProperty({ example: 2027 })
  @IsNumber()
  exp_year: number;

  @ApiProperty({ example: '4242424242424242' })
  @IsCreditCard()
  number: string;
}
