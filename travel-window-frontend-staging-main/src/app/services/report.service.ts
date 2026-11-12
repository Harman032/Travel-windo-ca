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

  /** Per-supplier statement. A single supplier is required; the backend 400s without one. */
  getSupplierStatement(supplier: string, dateFrom?: string, dateTo?: string): Observable<any> {
    let params = new HttpParams().set('supplier', supplier);
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);
    return this.http.get(`${this.apiUrl}/reports/payment-to-suppliers`, { params });
  }

  // Money actually sent to a supplier. There is no update endpoint on purpose: a wrong entry is
  // deleted and re-entered, which leaves a clearer trail than a mutable amount.
  addSupplierPayment(body: { supplier: string; paymentDate: string; amount: number; reference?: string; note?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/supplier-payments`, body);
  }

  deleteSupplierPayment(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/supplier-payments/${id}`);
  }

  getSupplierPayments(supplier: string, dateFrom?: string, dateTo?: string): Observable<any> {
    let params = new HttpParams().set('supplier', supplier);
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo) params = params.set('dateTo', dateTo);
    return this.http.get(`${this.apiUrl}/supplier-payments`, { params });
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
