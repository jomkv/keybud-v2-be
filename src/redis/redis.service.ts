import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import EnvironmentVariables from 'src/shared/env-variables';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  onModuleInit() {
    this.client = new Redis({
      port: EnvironmentVariables.redisPort,
      host: EnvironmentVariables.redisHost,
    });
  }

  onModuleDestroy() {
    this.client.quit();
  }

  async set(
    key: string,
    value: string,
    ttlInSeconds: number = 300,
  ): Promise<void> {
    console.log(`SET ${key} = ${value}`);

    await this.client.set(key, value, 'EX', ttlInSeconds);
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async getMany(keys: string[]): Promise<string[]> {
    return this.client.mget(keys);
  }

  async delete(key: string): Promise<number> {
    console.log(`DELETE ${key}`);

    return this.client.del(key);
  }
}
