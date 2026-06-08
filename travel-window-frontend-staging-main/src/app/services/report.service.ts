import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getDateWiseReport(dateFrom: string, dateTo: string): Observable<any> {
    const params = new HttpParams()
      .set('dateFrom', dateFrom)
      .set('dateTo', dateTo);
    return this.http.get(`${this.apiUrl}/reports/date-wise`, { params });
  }

  getSupplierWiseReport(supplier?: string, dateFrom?: string, dateTo?: string): Observable<any> {
    let params = new HttpParams();
    if (supplier) params = params.set('supplier', supplier);
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);
    return this.http.get(`${this.apiUrl}/reports/supplier-wise`, { params });
  }

  getEmployeeWiseReport(employee?: string, dateFrom?: string, dateTo?: string): Observable<any> {
    let params = new HttpParams();
    if (employee) params = params.set('employee', employee);
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);
    return this.http.get(`${this.apiUrl}/reports/employee-wise`, { params });
  }

  getPendingVerificationReport(): Observable<any> {
    return this.http.get(`${this.apiUrl}/reports/pending-verification`);
  }

  getOutstandingBalanceReport(): Observable<any> {
    return this.http.get(`${this.apiUrl}/reports/outstanding-balance`);
  }

  getPaymentToSupplierReport(dateFrom?: string, dateTo?: string): Observable<any> {
    let params = new HttpParams();
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);
    return this.http.get(`${this.apiUrl}/reports/payment-to-supplier`, { params });
  }

  getUnverifiedPaymentsReport(paymentType: string = 'all', verificationType: string = 'original'): Observable<any> {
    let params = new HttpParams();
    if (paymentType !== 'all') {
      params = params.set('paymentType', paymentType);
    }
    params = params.set('verificationType', verificationType);
    return this.http.get(`${this.apiUrl}/reports/unverified-payments`, { params });
  }

  getAgentMarginReport(dateFrom?: string, dateTo?: string): Observable<any> {
    let params = new HttpParams();
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);
    return this.http.get(`${this.apiUrl}/reports/agent-margin`, { params });
  }

  getAgentBookingList(dateFrom?: string, dateTo?: string, employee?: string): Observable<any> {
    let params = new HttpParams();
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);
    if (employee) params = params.set('employee', employee);
    return this.http.get(`${this.apiUrl}/reports/agent-booking-list`, { params });
  }

  getAgentMarginDetailReport(dateFrom?: string, dateTo?: string, employee?: string): Observable<any> {
    let params = new HttpParams();
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);
    if (employee) params = params.set('employee', employee);
    return this.http.get(`${this.apiUrl}/reports/agent-margin-report`, { params });
  }

  getFinancialSummary(dateFrom: string, dateTo: string): Observable<any> {
    const params = new HttpParams()
      .set('dateFrom', dateFrom)
      .set('dateTo', dateTo);
    return this.http.get(`${this.apiUrl}/reports/financial-summary`, { params });
  }

  verifyBookingFromReport(bookingId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/bookings/${bookingId}`, { accountVerified: true });
  }

  getVerifiedPayments(params: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);
    if (params.agent) httpParams = httpParams.set('agent', params.agent);
    if (params.verificationType) httpParams = httpParams.set('verificationType', params.verificationType);
    return this.http.get(`${this.apiUrl}/reports/verified-payments`, { params: httpParams });
  }
}
