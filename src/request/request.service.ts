import { Injectable, Scope } from '@nestjs/common';
import { TokenPayload } from '../shared/types/auth';

@Injectable({ scope: Scope.REQUEST })
export class RequestService {
  private userPayload: TokenPayload;
  private sessionNonce: string | null = null;

  setUserPayload(payload: TokenPayload) {
    this.userPayload = payload;
  }

  getUserPayload() {
    return this.userPayload;
  }

  setSessionNonce(nonce: string | null): void {
    this.sessionNonce = nonce;
  }

  getSessionNonce(): string | null {
    return this.sessionNonce;
  }
}
