import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
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

  async upload(key: string, file: Buffer): Promise<void> {
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

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: EnvironmentVariables.s3Name,
          Key: key,
        }),
      );

      console.log(`Successfully deleted object: ${key}`);
    } catch (error) {
      console.error('S3 Deletion Error:', error);

      throw new InternalServerErrorException('File deletion failed');
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: EnvironmentVariables.s3Name,
          Delete: {
            Objects: keys.map((key) => ({ Key: key })),
          },
        }),
      );

      console.log(`Successfully deleted ${keys.length} objects`);
    } catch (error) {
      console.error('S3 Bulk Deletion Error:', error);
      throw new InternalServerErrorException('Bulk file deletion failed');
    }
  }
}
