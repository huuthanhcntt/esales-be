import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MediaService } from './media.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { JwtAuthGuard, MEDIA_PATTERNS } from '@app/common';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadFileDto: UploadFileDto,
  ) {
    return this.mediaService.upload(file, uploadFileDto.folder);
  }

  @Get(':key')
  async getUrl(@Param('key') key: string) {
    const url = await this.mediaService.getSignedUrl(key);
    return { key, url };
  }

  @Delete(':key')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('key') key: string) {
    await this.mediaService.delete(key);
    return { deleted: true, key };
  }

  // Inter-service message patterns
  @MessagePattern(MEDIA_PATTERNS.UPLOAD)
  async rpcUpload(@Payload() data: { buffer: Buffer; originalname: string; mimetype: string; size: number; folder?: string }) {
    const file = {
      buffer: Buffer.from(data.buffer),
      originalname: data.originalname,
      mimetype: data.mimetype,
      size: data.size,
    } as Express.Multer.File;
    return this.mediaService.upload(file, data.folder);
  }

  @MessagePattern(MEDIA_PATTERNS.DELETE)
  async rpcDelete(@Payload() data: { key: string }) {
    await this.mediaService.delete(data.key);
    return { deleted: true, key: data.key };
  }

  @MessagePattern(MEDIA_PATTERNS.GET_URL)
  async rpcGetUrl(@Payload() data: { key: string }) {
    const url = await this.mediaService.getSignedUrl(data.key);
    return { key: data.key, url };
  }
}
