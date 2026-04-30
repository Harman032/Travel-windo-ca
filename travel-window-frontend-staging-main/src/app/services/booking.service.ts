import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Booking {
  _id?: string;
  dateOfSubmission?: Date;
  submittedBy?: any;
  submittedByName?: string;
  paxName: string;
  contactPerson?: string;
  contactNumber: string;
  pnr: string;
  sectorType: 'One Way' | 'Round Trip' | 'Multiple';
  travelDate: Date;
  from: string;
  to: string;
  returnDate?: Date;
  multipleSectors?: any[];
  note?: string;
  airline?: string;
  supplier?: any;
  supplierName?: string;
  ourCost?: number;
  salePrice?: number;
  additionalService?: string;
  additionalServicePrice?: number;
  totalSalePrice?: number;
  paymentType?: 'Full' | 'Installments';
  payments?: Payment[];
  totalPaidAmount?: number;
  balanceAmount?: number;
  billingStatus?: 'Partial Paid' | 'Fully Paid' | 'Unpaid';
  status?: string;
  verifiedByAccount?: boolean;
  verifiedByAdmin?: boolean;
  assignedTo?: { _id: string; name: string; email?: string };
  progressHistory?: any[];
  dateChanges?: any[];
  flightChanges?: any[];
  seatBookChanges?: any[];
  cancellation?: any;
}

export interface Payment {
  paidAmount: number;
  paymentMode: 'Cash' | 'Cheque' | 'Credit Card' | 'UPI' | 'Bank Transfer';
  paymentDate: Date;
  referenceNo?: string;
}

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  createBooking(booking: Booking): Observable<Booking> {
    return this.http.post<Booking>(`${this.apiUrl}/bookings`, booking);
  }

  getBookings(params?: any): Observable<{ bookings: Booking[], totalPages: number, currentPage: number, total: number }> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<{ bookings: Booking[], totalPages: number, currentPage: number, total: number }>(`${this.apiUrl}/bookings`, { params: httpParams });
  }

  getBooking(id: string): Observable<Booking> {
    return this.http.get<Booking>(`${this.apiUrl}/bookings/${id}`);
  }

  updateBooking(id: string, booking: Partial<Booking>): Observable<Booking> {
    return this.http.put<Booking>(`${this.apiUrl}/bookings/${id}`, booking);
  }

  searchBookings(query: string): Observable<Booking[]> {
    return this.http.get<Booking[]>(`${this.apiUrl}/bookings/search/${query}`);
  }

  submitBooking(id: string): Observable<Booking> {
    return this.http.post<Booking>(`${this.apiUrl}/bookings/${id}/submit`, {});
  }

  verifyByAccount(id: string): Observable<Booking> {
    return this.http.post<Booking>(`${this.apiUrl}/bookings/${id}/verify-account`, {});
  }

  verifyByAdmin(id: string): Observable<Booking> {
    return this.http.post<Booking>(`${this.apiUrl}/bookings/${id}/verify-admin`, {});
  }

  dateChange(id: string, data: any): Observable<Booking> {
    return this.http.post<Booking>(`${this.apiUrl}/bookings/${id}/date-change`, data);
  }

  flightChange(id: string, data: any): Observable<Booking> {
    return this.http.post<Booking>(`${this.apiUrl}/bookings/${id}/flight-change`, data);
  }

  seatBook(id: string, data: any): Observable<Booking> {
    return this.http.post<Booking>(`${this.apiUrl}/bookings/${id}/seat-book`, data);
  }

  cancelBooking(id: string, data: any): Observable<Booking> {
    return this.http.post<Booking>(`${this.apiUrl}/bookings/${id}/cancel`, data);
  }

  processRefund(id: string): Observable<Booking> {
    return this.http.post<Booking>(`${this.apiUrl}/bookings/${id}/process-refund`, {});
  }

  assignBooking(id: string, assignToUserId: string, comment?: string): Observable<Booking> {
    return this.http.post<Booking>(`${this.apiUrl}/bookings/${id}/assign`, { assignToUserId, comment });
  }
}
