import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  _id?: string;
  email: string;
  name: string;
  role: 'AGENT1' | 'AGENT2' | 'ACCOUNT' | 'ADMIN';
  isActive?: boolean;
  photo?: string;
}

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`);
  }

  getAgents(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users/agents`);
  }

  /** Users current role can assign a booking to (Account/Agent2/Admin only) */
  getAssignableUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users/assignable`);
  }

  createUser(user: User & { password: string }): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users`, user);
  }

  updateUser(id: string, user: Partial<User> & { password?: string }): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/${id}`, user);
  }

  deleteUser(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/users/${id}`);
  }
}
