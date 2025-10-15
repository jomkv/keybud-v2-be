class EnvironmentVariables {
  public env = process.env.NODE_ENV || 'production';

  get isProd(): boolean {
    return this.env === 'production';
  }

  get isDev(): boolean {
    return !this.isProd;
  }

  get jwtSecret(): string {
    return process.env.JWT_SECRET;
  }

  get clientId(): string {
    return process.env.GOOGLE_CLIENT_ID;
  }

  get clientSecret(): string {
    return process.env.GOOGLE_CLIENT_SECRET;
  }

  get baseUrl(): string {
    return process.env.BASE_URL;
  }

  get clientUrl(): string {
    return process.env.CLIENT_URL;
  }

  get redisHost(): string {
    return process.env.REDIS_HOST;
  }

  get redisPort(): number {
    return process.env.REDIS_PORT as unknown as number;
  }

  get s3Region(): string {
    return process.env.S3_REGION;
  }

  get s3Name(): string {
    return process.env.S3_Name;
  }

  get s3AccessKey(): string {
    return process.env.S3_ACCESS_KEY;
  }

  get s3SecretKey(): string {
    return process.env.S3_SECRET_KEY;
  }
}

export default new EnvironmentVariables();
