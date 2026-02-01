import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import EnvironmentVariables from 'src/shared/env-variables';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: EnvironmentVariables.dbUrl,
    });
    super({ adapter });
  }

  onModuleInit() {
    this.$connect()
      .then(() => console.log('DB Connected'))
      .catch((error) => console.log('Unable to conect to DB: ', error));
  }
}
