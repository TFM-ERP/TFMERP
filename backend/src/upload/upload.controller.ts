import {
  Controller, Post, UseInterceptors, UploadedFile,
  UseGuards, BadRequestException, Param, Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';

const ALLOWED_TYPES = /\.(jpg|jpeg|png|pdf|webp|heic|fdx|docx|txt|fountain)$/i;
const MAX_SIZE_MB = 15;

const storage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

@ApiTags('Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  @Post()
  @ApiOperation({ summary: 'Upload a file (image or PDF, max 10 MB)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage,
      limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_TYPES.test(extname(file.originalname))) {
          cb(new BadRequestException('Only images (jpg, png, webp, heic) and PDFs are allowed'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  uploadFile(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file provided');
    return {
      url: `/uploads/${file.filename}`,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Delete(':filename')
  @ApiOperation({ summary: 'Delete an uploaded file' })
  deleteFile(@Param('filename') filename: string) {
    // Security: only allow simple filenames (no path traversal)
    if (!/^[a-zA-Z0-9\-_.]+$/.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }
    const filePath = join(process.cwd(), 'uploads', filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    return { deleted: true };
  }
}
