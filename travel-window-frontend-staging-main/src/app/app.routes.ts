import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { authGuard } from './guards/auth.guard';
import { NewBookingComponent } from './components/bookings/new-booking/new-booking.component';
import { BookingListComponent } from './components/bookings/booking-list/booking-list.component';
import { BookingDetailComponent } from './components/bookings/booking-detail/booking-detail.component';
import { SearchBookingComponent } from './components/bookings/search-booking/search-booking.component';
import { ReportsComponent } from './components/reports/reports.component';
import { ManageUsersComponent } from './components/admin/manage-users/manage-users.component';
import { ManageSuppliersComponent } from './components/admin/manage-suppliers/manage-suppliers.component';
import { PaymentsManagementComponent } from './components/admin/payments-management/payments-management.component';
import { DashboardHomeComponent } from './components/dashboard/dashboard-home/dashboard-home.component';
import { SettingsComponent } from './components/settings/settings.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardHomeComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'bookings/new', component: NewBookingComponent },
      { path: 'bookings', component: BookingListComponent },
      { path: 'bookings/search', component: SearchBookingComponent },
      { path: 'bookings/:id', component: BookingDetailComponent },
      { path: 'bookings/:id/edit', component: NewBookingComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'admin/users', component: ManageUsersComponent },
      { path: 'admin/suppliers', component: ManageSuppliersComponent },
      { path: 'admin/payments', component: PaymentsManagementComponent }
    ]
  },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];
