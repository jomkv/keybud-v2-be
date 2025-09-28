class EnvironmentVariables {
  public env = process.env.NODE_ENV || 'production';

  get isProd(): boolean {
    return this.env === 'production';
  }

  get isDev(): boolean {
    return !this.isProd;
  }
}

export default new EnvironmentVariables();
