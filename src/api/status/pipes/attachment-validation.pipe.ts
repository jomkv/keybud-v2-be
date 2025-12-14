import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { CONSTANTS } from 'src/shared/constants';

@Injectable()
export class AttachmentValidationPipe implements PipeTransform {
  private readonly maxFileSize = CONSTANTS.MAX_IMAGE_ATTACHMENT_SIZE;
  private readonly allowedImageTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  transform(files: Express.Multer.File[], metadata: ArgumentMetadata) {
    if (!files || files.length === 0) {
      return files; // Allow empty file arrays
    }

    for (const file of files) {
      if (!file) continue;

      if (!this.allowedImageTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Attachment "${file.originalname}" is of invalid file type.`,
        );
      }

      if (file.size > this.maxFileSize) {
        throw new BadRequestException(
          `Attachment "${file.originalname}" too large.`,
        );
      }
    }

    return files;
  }
}
