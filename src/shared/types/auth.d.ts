import { type Profile } from 'passport-google-oauth20';

export type AuthInput = Profile;

export type AuthResult = {
  accessToken: string;
  userId: string;
  username: string;
};

export type TokenPayload = { sub: string; username: string };
