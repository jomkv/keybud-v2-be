import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import EnvironmentVariables from 'src/shared/env-variables';

@Injectable()
export class UploadService {
  private readonly client = new S3Client({
    region: EnvironmentVariables.s3Region,
    credentials: {
      accessKeyId: EnvironmentVariables.s3AccessKey,
      secretAccessKey: EnvironmentVariables.s3SecretKey,
    },
  });

  constructor() {}

  async upload(key: string, file: Buffer) {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: EnvironmentVariables.s3Name,
          Key: key,
          Body: file,
        }),
      );
    } catch (error) {
      console.error('S3 Upload Error:', error);

      throw new InternalServerErrorException('File upload failed');
    }
  }
}
