import { Injectable, Scope } from '@nestjs/common';
import { User } from '@prisma/client';

@Injectable({ scope: Scope.REQUEST })
export class RequestService {
  private user: User | null = null;
  private sessionNonce: string | null = null;

  setUser(user: User) {
    this.user = user;
  }

  getUser(): User | null {
    return this.user;
  }

  setSessionNonce(nonce: string | null): void {
    this.sessionNonce = nonce;
  }

  getSessionNonce(): string | null {
    return this.sessionNonce;
  }
}
