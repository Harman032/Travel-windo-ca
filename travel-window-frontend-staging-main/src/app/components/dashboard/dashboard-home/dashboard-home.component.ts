import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { DashboardService, DashboardStats, ActivityItem } from '../../../services/dashboard.service';
import { NotificationService, Notification } from '../../../services/notification.service';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="page-title-card">
        <h2 class="page-title">Dashboard</h2>
        <p class="text-white/90 text-sm mt-1">Welcome back, {{ currentUserName }}</p>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <!-- Skeleton loading -->
        <ng-container *ngIf="loadingStats">
          <div *ngFor="let i of [1,2,3,4]" class="skeleton-card">
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <div class="skeleton-line w-20 h-3 mb-2"></div>
                <div class="skeleton-line w-16 h-6"></div>
              </div>
              <div class="skeleton-circle w-12 h-12"></div>
            </div>
          </div>
        </ng-container>
        <!-- Actual stats -->
        <ng-container *ngIf="!loadingStats">
        <div class="card hover:shadow-lg transition-shadow">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500">Total Bookings</p>
              <p class="text-2xl font-bold text-gray-900 mt-1">{{ stats?.totalBookings ?? '–' }}</p>
            </div>
            <div class="h-12 w-12 rounded-full bg-[#0096D2]/10 flex items-center justify-center">
              <svg class="w-6 h-6 text-[#0096D2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
            </div>
          </div>
          <a [routerLink]="['/dashboard/bookings']" class="text-xs text-[#0096D2] hover:underline mt-2 inline-block">View all</a>
        </div>
        <div class="card hover:shadow-lg transition-shadow" *ngIf="showPendingVerificationCard()">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500">Pending Verification</p>
              <p class="text-2xl font-bold text-gray-900 mt-1">{{ stats?.pendingVerificationCount ?? '–' }}</p>
            </div>
            <div class="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          </div>
          <a [routerLink]="['/dashboard/bookings']" [queryParams]="{ status: 'Pending Verification' }" class="text-xs text-[#0096D2] hover:underline mt-2 inline-block">View</a>
        </div>
        <a [routerLink]="['/dashboard/bookings']" [queryParams]="{ status: 'Unticketed' }" class="card hover:shadow-lg transition-shadow block">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500">Unticketed</p>
              <p class="text-2xl font-bold text-gray-900 mt-1">{{ stats?.unticketedCount ?? '–' }}</p>
            </div>
            <div class="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path>
              </svg>
            </div>
          </div>
          <span class="text-xs text-[#0096D2] hover:underline mt-2 inline-block">View</span>
        </a>
        <div class="card hover:shadow-lg transition-shadow" *ngIf="stats?.assignedTicketsCount !== undefined">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500">Assigned Tickets</p>
              <p class="text-2xl font-bold text-gray-900 mt-1">{{ stats?.assignedTicketsCount ?? '–' }}</p>
            </div>
            <div class="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
            </div>
          </div>
          <a [routerLink]="['/dashboard/bookings']" class="text-xs text-[#0096D2] hover:underline mt-2 inline-block">View</a>
        </div>
        <div class="card hover:shadow-lg transition-shadow" *ngIf="stats?.totalUsers !== undefined">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500">Active Users</p>
              <p class="text-2xl font-bold text-gray-900 mt-1">{{ stats?.totalUsers ?? '–' }}</p>
            </div>
            <div class="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
            </div>
          </div>
          <a [routerLink]="['/dashboard/admin/users']" class="text-xs text-[#0096D2] hover:underline mt-2 inline-block" *ngIf="isAdmin">Manage</a>
        </div>
        </ng-container>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Notifications -->
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-[#0096D2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
            </svg>
            Notifications
          </h3>
          <!-- Loading skeleton -->
          <div *ngIf="loadingNotifications" class="space-y-2 max-h-80 overflow-y-auto">
            <div *ngFor="let i of [1,2,3,4]" class="p-3 rounded-lg border border-gray-100">
              <div class="skeleton-line w-3/4 h-4 mb-2"></div>
              <div class="skeleton-line w-full h-3 mb-1"></div>
              <div class="skeleton-line w-24 h-3"></div>
            </div>
          </div>
          <!-- Actual notifications -->
          <div *ngIf="!loadingNotifications" class="space-y-2 max-h-80 overflow-y-auto">
            <ng-container *ngIf="notifications.length > 0; else noNotifications">
              <a
                *ngFor="let n of notifications.slice(0, 8)"
                [routerLink]="n.link || []"
                class="block p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                [class.bg-primary-50]="!n.read"
              >
                <p class="text-sm font-medium text-gray-900">{{ n.title }}</p>
                <p class="text-xs text-gray-600 mt-0.5">{{ n.message }}</p>
                <p class="text-xs text-gray-400 mt-1">{{ n.timestamp | date:'short' }}</p>
              </a>
            </ng-container>
            <ng-template #noNotifications>
              <p class="text-sm text-gray-500 py-4 text-center">No notifications</p>
            </ng-template>
          </div>
          <a [routerLink]="['/dashboard/bookings']" class="text-sm text-[#0096D2] hover:underline mt-2 inline-block">View all bookings</a>
        </div>

        <!-- Activity -->
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-[#0096D2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Recent Activity
          </h3>
          <!-- Loading skeleton -->
          <div *ngIf="loadingActivity" class="space-y-0 max-h-80 overflow-y-auto">
            <div *ngFor="let i of [1,2,3,4,5]" class="flex gap-3 py-3" [class.border-t]="i > 1" [class.border-gray-100]="i > 1">
              <div class="skeleton-circle w-2 h-2 mt-2"></div>
              <div class="flex-1">
                <div class="skeleton-line w-3/4 h-4 mb-2"></div>
                <div class="skeleton-line w-1/2 h-3 mb-1"></div>
                <div class="skeleton-line w-20 h-3"></div>
              </div>
            </div>
          </div>
          <!-- Actual activity -->
          <div *ngIf="!loadingActivity" class="space-y-0 max-h-80 overflow-y-auto">
            <ng-container *ngIf="activity.length > 0; else noActivity">
              <div
                *ngFor="let a of activity; let i = index"
                class="flex gap-3 py-3"
                [class.border-t]="i > 0"
                [class.border-gray-100]="i > 0"
              >
                <div class="flex-shrink-0 w-2 h-2 rounded-full bg-[#0096D2] mt-2"></div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-gray-900">{{ a.action }}</p>
                  <p class="text-xs text-gray-500">
                    {{ a.performedByName }}
                    <span *ngIf="a.pnr"> · PNR {{ a.pnr }}</span>
                    <span *ngIf="a.remarks"> · {{ a.remarks }}</span>
                  </p>
                  <p class="text-xs text-gray-400 mt-0.5">{{ a.timestamp | date:'short' }}</p>
                  <a [routerLink]="['/dashboard/bookings', a.bookingId]" class="text-xs text-[#0096D2] hover:underline">View booking</a>
                </div>
              </div>
            </ng-container>
            <ng-template #noActivity>
              <p class="text-sm text-gray-500 py-4 text-center">No recent activity</p>
            </ng-template>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardHomeComponent implements OnInit {
  stats: DashboardStats | null = null;
  activity: ActivityItem[] = [];
  notifications: Notification[] = [];
  currentUserName = '';
  isAdmin = false;
  loadingStats = true;
  loadingActivity = true;
  loadingNotifications = true;

  constructor(
    private dashboardService: DashboardService,
    private notificationService: NotificationService,
    private authService: AuthService
  ) {}

  /** Agent 2 ko Pending Verification card nahi dikhana */
  showPendingVerificationCard(): boolean {
    return !this.authService.hasRole('AGENT2');
  }

  ngOnInit() {
    const user = this.authService.getCurrentUserValue();
    this.currentUserName = user?.name ?? 'User';
    this.isAdmin = this.authService.hasRole('ADMIN');

    this.dashboardService.getStats().subscribe({
      next: (s: DashboardStats) => {
        this.stats = s;
        this.loadingStats = false;
      },
      error: () => {
        this.stats = null;
        this.loadingStats = false;
      }
    });

    this.dashboardService.getActivity(15).subscribe({
      next: (a: ActivityItem[]) => {
        this.activity = a;
        this.loadingActivity = false;
      },
      error: () => {
        this.activity = [];
        this.loadingActivity = false;
      }
    });

    this.notificationService.notifications$.subscribe((n: Notification[]) => {
      this.notifications = n;
      this.loadingNotifications = false;
    });
  }
}
