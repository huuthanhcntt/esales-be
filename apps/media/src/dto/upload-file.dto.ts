import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiPropertyOptional({ example: 'products' })
  @IsOptional()
  @IsString()
  folder?: string;
}
