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
  receivingAccount: string;
  senderName: string;
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

export type PaymentModeFilter = 'All Modes' | 'Cash' | 'Credit Card' | 'UPI' | 'E-Transfer' | 'Machine Charge';

/**
 * Bank filter values. 'Not recorded' covers an E-Transfer saved before the two fields existed
 * plus every legacy Cheque and Bank Transfer row -- the server tests "has no receivingAccount"
 * rather than a list of modes.
 *
 * The two account labels mirror RECEIVING_ACCOUNTS in
 * travel-window-backend-staging-main/utils/receiving-accounts.js.
 */
export type ReceivingAccountFilter = 'All' | 'RBC 6336' | 'TD 0638' | 'Not recorded';
export const RECEIVING_ACCOUNT_FILTERS: ReceivingAccountFilter[] = ['All', 'RBC 6336', 'TD 0638', 'Not recorded'];

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
    receivingAccount?: ReceivingAccountFilter | string;
  } = {}): Observable<PaymentsResponse> {
    let params = new HttpParams();
    if (filters.pnr?.trim()) params = params.set('pnr', filters.pnr.trim());
    if (filters.paymentMode && filters.paymentMode !== 'All Modes') params = params.set('paymentMode', filters.paymentMode);
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);
    if (filters.receivingAccount && filters.receivingAccount !== 'All') {
      params = params.set('receivingAccount', filters.receivingAccount);
    }
    return this.http.get<PaymentsResponse>(`${this.apiUrl}/payments`, { params });
  }
}
