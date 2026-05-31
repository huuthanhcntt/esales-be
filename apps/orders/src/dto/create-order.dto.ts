import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderItemDto } from './order-item.dto';

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({ example: 'VND', default: 'VND' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'Please deliver before 5pm' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: { street: '123 Nguyen Hue', city: 'Ho Chi Minh', zip: '70000' },
  })
  @IsOptional()
  shippingAddress?: Record<string, any>;
}
