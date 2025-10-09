class EnvironmentVariables {
  public env = process.env.NODE_ENV || 'production';

  get isProd(): boolean {
    return this.env === 'production';
  }

  get isDev(): boolean {
    return !this.isProd;
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
}

export default new EnvironmentVariables();
