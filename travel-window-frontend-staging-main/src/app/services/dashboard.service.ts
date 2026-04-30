import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DashboardStats {
  totalBookings: number;
  draftCount: number;
  pendingVerificationCount: number;
  unticketedCount: number;
  cancelledCount: number;
  totalUsers?: number;
  assignedTicketsCount?: number;
}

export interface ActivityItem {
  action: string;
  performedByName: string;
  timestamp: string;
  remarks?: string;
  pnr: string;
  bookingId: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/dashboard/stats`);
  }

  getActivity(limit = 20): Observable<ActivityItem[]> {
    return this.http.get<ActivityItem[]>(`${this.apiUrl}/dashboard/activity`, {
      params: { limit: String(limit) }
    });
  }
}
