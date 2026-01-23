import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable, tap, catchError, of } from 'rxjs';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { RegisterDto, LoginDto, AuthResponse } from '@la-grieta/shared';
import { User } from '@la-grieta/shared';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);
  private readonly tokenKey = 'la_grieta_token';

  // Use Angular Signals for reactive state management
  private currentUserSignal = signal<User | null>(null);
  private loadingSignal = signal<boolean>(false);

  // Public readonly signals
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  constructor() {
    this.loadCurrentUser();
  }

  register(dto: RegisterDto): Observable<AuthResponse> {
    this.loadingSignal.set(true);

    return this.api.post<AuthResponse>('auth/register', dto).pipe(
      tap(response => {
        this.setToken(response.token);
        this.currentUserSignal.set(response.user);
        this.loadingSignal.set(false);
      }),
      catchError(error => {
        this.loadingSignal.set(false);
        throw error;
      })
    );
  }

  login(dto: LoginDto): Observable<AuthResponse> {
    this.loadingSignal.set(true);

    return this.api.post<AuthResponse>('auth/login', dto).pipe(
      tap(response => {
        this.setToken(response.token);
        this.currentUserSignal.set(response.user);
        this.loadingSignal.set(false);
      }),
      catchError(error => {
        this.loadingSignal.set(false);
        throw error;
      })
    );
  }

  logout(): void {
    this.removeToken();
    this.currentUserSignal.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(this.tokenKey);
    }
    return null;
  }

  private setToken(token: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.tokenKey, token);
    }
  }

  private removeToken(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.tokenKey);
    }
  }

  private loadCurrentUser(): void {
    const token = this.getToken();

    if (token) {
      this.loadingSignal.set(true);

      this.api.get<User>('auth/me').pipe(
        tap(user => {
          this.currentUserSignal.set(user);
          this.loadingSignal.set(false);
        }),
        catchError(() => {
          this.logout();
          this.loadingSignal.set(false);
          return of(null);
        })
      ).subscribe();
    }
  }
}
