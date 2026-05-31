import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'user@esales.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass1!@' })
  @IsStrongPassword()
  password: string;

  @ApiPropertyOptional({ example: ['Admin'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  roles?: string[];
}
