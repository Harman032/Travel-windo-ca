import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { TokenStorageService } from './token-storage.service';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'AGENT1' | 'AGENT2' | 'ACCOUNT' | 'ADMIN';
  photo?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private tokenStorage: TokenStorageService
  ) {
    const token = this.getToken();
    if (token) {
      this.getCurrentUser().subscribe();
    }
  }

  login(email: string, password: string, rememberMe: boolean = true, recaptchaToken?: string): Observable<AuthResponse> {
    const body: { email: string; password: string; recaptchaToken?: string } = { email, password };
    if (recaptchaToken) body.recaptchaToken = recaptchaToken;
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, body, {
      withCredentials: true
    })
      .pipe(
        tap(response => {
          this.tokenStorage.saveToken(response.token, rememberMe);
          this.currentUserSubject.next(response.user);
        })
      );
  }

  logout(): void {
    this.tokenStorage.clearToken();
    this.currentUserSubject.next(null);
  }

  getCurrentUser(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(`${this.apiUrl}/auth/me`, {
      withCredentials: true
    })
      .pipe(
        tap(response => {
          this.currentUserSubject.next(response.user);
        })
      );
  }

  getToken(): string | null {
    return this.tokenStorage.getToken();
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  hasRole(role: string): boolean {
    const user = this.currentUserSubject.value;
    return user?.role === role;
  }

  hasAnyRole(roles: string[]): boolean {
    const user = this.currentUserSubject.value;
    return user ? roles.includes(user.role) : false;
  }

  getCurrentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  updateProfile(data: { name?: string; photo?: string }): Observable<{ user: User }> {
    return this.http.put<{ user: User }>(`${this.apiUrl}/auth/me`, data, { withCredentials: true })
      .pipe(tap(res => this.currentUserSubject.next(res.user)));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/me/change-password`, {
      currentPassword,
      newPassword
    }, { withCredentials: true });
  }
}
