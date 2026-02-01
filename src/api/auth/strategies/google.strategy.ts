import { Strategy } from 'passport-google-oauth20';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import EnvironmentVariables from 'src/shared/env-variables';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const config = {
      clientID: EnvironmentVariables.clientId,
      clientSecret: EnvironmentVariables.clientSecret,
      callbackURL: `${EnvironmentVariables.baseUrl}/auth/google/redirect`,
      scope: ['profile', 'email', 'openid'],
    };

    super(config);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: string,
  ): Promise<any> {
    return profile;
  }
}
