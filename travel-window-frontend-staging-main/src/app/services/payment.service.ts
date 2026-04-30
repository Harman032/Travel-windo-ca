import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PaymentRow {
  date: string;
  bookingPnr: string;
  passenger: string;
  amount: number;
  mode: string;
  reference: string;
  addedBy: string;
  bookingId: string;
}

export interface PaymentsResponse {
  payments: PaymentRow[];
  summary: {
    totalPayments: number;
    totalAmount: number;
    averagePayment: number;
  };
}

export type PaymentModeFilter = 'All Modes' | 'Cash' | 'Cheque' | 'Credit Card' | 'UPI' | 'Bank Transfer';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getPayments(filters: {
    pnr?: string;
    paymentMode?: PaymentModeFilter | string;
    startDate?: string;
    endDate?: string;
  } = {}): Observable<PaymentsResponse> {
    let params = new HttpParams();
    if (filters.pnr?.trim()) params = params.set('pnr', filters.pnr.trim());
    if (filters.paymentMode && filters.paymentMode !== 'All Modes') params = params.set('paymentMode', filters.paymentMode);
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);
    return this.http.get<PaymentsResponse>(`${this.apiUrl}/payments`, { params });
  }
}
