import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly tokenKey = 'token';

  getToken(): string | null {
    return (
      sessionStorage.getItem(this.tokenKey) ||
      localStorage.getItem(this.tokenKey)
    );
  }

  saveToken(token: string, rememberMe: boolean): void {
    localStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.tokenKey);

    if (rememberMe) {
      localStorage.setItem(this.tokenKey, token);
    } else {
      sessionStorage.setItem(this.tokenKey, token);
    }
  }

  clearToken(): void {
    localStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.tokenKey);
  }
}
