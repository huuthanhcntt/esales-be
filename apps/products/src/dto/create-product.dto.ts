import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
}

export class CreateProductDto {
  @ApiProperty({ example: 'iPhone 15 Pro Max' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Latest Apple smartphone with A17 Pro chip' })
  @IsString()
  description: string;

  @ApiProperty({ example: 29990000 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'VND', default: 'VND' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'IP15PM-256-BK' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ enum: ProductStatus, default: 'ACTIVE' })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ example: { color: 'Black', storage: '256GB' } })
  @IsOptional()
  metadata?: Record<string, any>;
}
