import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule, RouterOutlet, NavigationEnd } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { NotificationService, Notification } from '../../services/notification.service';
import { Subscription, filter } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  providers: [DatePipe],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header - Clean white like travelwindow.ca -->
      <header class="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
        <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            <!-- Left: Mobile Menu Button + Logo -->
            <div class="flex items-center space-x-3">
              <button 
                (click)="toggleSidebar()" 
                class="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                [attr.aria-label]="'Toggle menu'"
              >
                <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
              </button>
              <img src="assets/logo.png" alt="TravelWindow Logo" class="max-h-[50px] object-contain" />
            </div>

            <!-- Right: User Info, Notifications, Logout -->
            <div class="flex items-center space-x-4">
              <!-- Notifications -->
              <div class="relative" data-notifications-dropdown (click)="$event.stopPropagation()">
                <button 
                  (click)="toggleNotifications()"
                  class="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  [attr.aria-label]="'Notifications'"
                >
                  <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                  </svg>
                  <span 
                    *ngIf="unreadCount > 0" 
                    class="absolute top-0 right-0 block h-5 w-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-bold"
                  >
                    {{ unreadCount > 9 ? '9+' : unreadCount }}
                  </span>
                </button>

                <!-- Notifications Dropdown -->
                <div 
                  *ngIf="showNotifications"
                  (click)="$event.stopPropagation()"
                  class="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col"
                >
                  <div class="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 class="font-semibold text-gray-800">Notifications</h3>
                    <div class="flex space-x-2">
                      <button 
                        (click)="markAllAsRead()" 
                        class="text-xs text-primary-600 hover:text-primary-700"
                        *ngIf="unreadCount > 0"
                      >
                        Mark all read
                      </button>
                      <button 
                        (click)="showNotifications = false" 
                        class="text-gray-400 hover:text-gray-600"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div class="overflow-y-auto flex-1">
                    <div *ngIf="notifications.length === 0" class="p-8 text-center text-gray-500">
                      <svg class="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                      </svg>
                      <p class="text-sm">No notifications</p>
                    </div>
                    <div *ngFor="let notification of notifications" 
                         class="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                         [class.bg-primary-50]="!notification.read"
                         (click)="handleNotificationClick(notification)">
                      <div class="flex items-start space-x-3">
                        <div class="flex-shrink-0 mt-1">
                          <div class="h-2 w-2 rounded-full"
                               [ngClass]="{
                                 'bg-primary-500': notification.type === 'warning',
                                 'bg-accent-500': notification.type === 'info',
                                 'bg-green-500': notification.type === 'success',
                                 'bg-red-500': notification.type === 'error'
                               }"
                          ></div>
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-gray-900">{{ notification.title }}</p>
                          <p class="text-sm text-gray-600 mt-1">{{ notification.message }}</p>
                          <p class="text-xs text-gray-400 mt-1">{{ notification.timestamp | date:'short' }}</p>
                        </div>
                        <button 
                          (click)="clearNotification(notification.id); $event.stopPropagation()"
                          class="flex-shrink-0 text-gray-400 hover:text-gray-600"
                        >
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- User Info -->
              <div class="hidden sm:flex items-center space-x-3">
                <div class="text-right">
                  <p class="text-sm font-medium text-gray-700">{{ currentUser?.name }}</p>
                  <p class="text-xs text-gray-500">{{ currentUser?.email }}</p>
                </div>
                <div class="badge gradient-logo text-white border-0 px-3 sm:px-4 py-1.5 text-xs sm:text-sm">{{ getRoleDisplayLabel() }}</div>
              </div>

              <!-- Logout Button -->
              <button (click)="logout()" class="btn gradient-logo px-3 sm:px-4 py-2 rounded-full font-medium border-0 text-white shadow-sm text-xs sm:text-sm">
                <span class="hidden sm:inline">Logout</span>
                <svg class="sm:hidden w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div class="flex h-[calc(100vh-4rem)] min-h-0 relative">
        <!-- Mobile Overlay -->
        <div 
          *ngIf="!sidebarCollapsed"
          (click)="toggleSidebar()"
          class="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
        ></div>
        
        <!-- Sidebar - Collapsible (drawer on mobile, sidebar on desktop) -->
        <aside 
          [class.w-64]="!sidebarCollapsed"
          [class.w-20]="sidebarCollapsed"
          [class.-translate-x-full]="sidebarCollapsed"
          [class.lg:translate-x-0]="true"
          class="fixed lg:static inset-y-0 left-0 z-50 bg-white shadow-lg lg:shadow-sm border-r border-gray-200 transition-all duration-300 ease-in-out overflow-hidden flex flex-col flex-shrink-0"
          style="top: 4rem;"
        >
          <nav class="p-4 space-y-2 flex-1 overflow-y-auto">
            <!-- Role label above menu (Admin Dashboard / Account Manager / Agent 1 / Agent 2) -->
            <div *ngIf="getSidebarRoleLabel()" class="px-4 pb-2 border-b border-gray-200" [class.text-center]="sidebarCollapsed">
              <span [class.hidden]="sidebarCollapsed" class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ getSidebarRoleLabel() }}</span>
              <span *ngIf="sidebarCollapsed" class="text-xs font-semibold text-gray-500" [title]="getSidebarRoleLabel()">•</span>
            </div>
            <a
              routerLink="/dashboard"
              routerLinkActive="gradient-logo-active shadow-sm"
              [routerLinkActiveOptions]="{exact: true}"
              class="flex items-center px-4 py-2 rounded-lg text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
              [class.justify-center]="sidebarCollapsed"
              [title]="sidebarCollapsed ? 'Dashboard' : ''"
            >
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z"></path>
              </svg>
              <span [class.hidden]="sidebarCollapsed" class="ml-3">Dashboard</span>
            </a>
            <a
              routerLink="/dashboard/bookings/new"
              routerLinkActive="gradient-logo-active shadow-sm"
              [routerLinkActiveOptions]="{exact: true}"
              class="flex items-center px-4 py-2 rounded-lg text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
              [class.justify-center]="sidebarCollapsed"
              *ngIf="canCreateBooking()"
              [title]="sidebarCollapsed ? 'New Booking' : ''"
            >
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
              </svg>
              <span [class.hidden]="sidebarCollapsed" class="ml-3">New Booking</span>
            </a>
            <a
              routerLink="/dashboard/bookings"
              routerLinkActive="gradient-logo-active shadow-sm"
              [routerLinkActiveOptions]="{exact: true}"
              class="flex items-center px-4 py-2 rounded-lg text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
              [class.justify-center]="sidebarCollapsed"
              [title]="sidebarCollapsed ? 'Manage Bookings' : ''"
            >
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
              </svg>
              <span [class.hidden]="sidebarCollapsed" class="ml-3">Manage Bookings</span>
            </a>
            <a
              routerLink="/dashboard/bookings/search"
              routerLinkActive="gradient-logo-active shadow-sm"
              class="flex items-center px-4 py-2 rounded-lg text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
              [class.justify-center]="sidebarCollapsed"
              [title]="sidebarCollapsed ? 'Search Booking' : ''"
            >
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <span [class.hidden]="sidebarCollapsed" class="ml-3">Search Booking</span>
            </a>
            <a
              routerLink="/dashboard/reports"
              routerLinkActive="gradient-logo-active shadow-sm"
              class="flex items-center px-4 py-2 rounded-lg text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
              [class.justify-center]="sidebarCollapsed"
              [title]="sidebarCollapsed ? 'Reports' : ''"
              *ngIf="canViewReports()"
            >
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              <span [class.hidden]="sidebarCollapsed" class="ml-3">Reports</span>
            </a>
            <a
              routerLink="/dashboard/admin/payments"
              routerLinkActive="gradient-logo-active shadow-sm"
              class="flex items-center px-4 py-2 rounded-lg text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
              [class.justify-center]="sidebarCollapsed"
              [title]="sidebarCollapsed ? 'Payments' : ''"
              *ngIf="isAdmin()"
            >
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span [class.hidden]="sidebarCollapsed" class="ml-3">Payments</span>
            </a>
            <a
              routerLink="/dashboard/admin/users"
              routerLinkActive="gradient-logo-active shadow-sm"
              class="flex items-center px-4 py-2 rounded-lg text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
              [class.justify-center]="sidebarCollapsed"
              [title]="sidebarCollapsed ? 'Manage Users' : ''"
              *ngIf="isAdmin()"
            >
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
              <span [class.hidden]="sidebarCollapsed" class="ml-3">Manage Users</span>
            </a>
            <a
              routerLink="/dashboard/admin/suppliers"
              routerLinkActive="gradient-logo-active shadow-sm"
              class="flex items-center px-4 py-2 rounded-lg text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
              [class.justify-center]="sidebarCollapsed"
              [title]="sidebarCollapsed ? 'Manage Suppliers' : ''"
              *ngIf="isAdmin()"
            >
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
              <span [class.hidden]="sidebarCollapsed" class="ml-3">Manage Suppliers</span>
            </a>
            <a
              routerLink="/dashboard/settings"
              routerLinkActive="gradient-logo-active shadow-sm"
              class="flex items-center px-4 py-2 rounded-lg text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
              [class.justify-center]="sidebarCollapsed"
              [title]="sidebarCollapsed ? 'Settings' : ''"
            >
              <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <span [class.hidden]="sidebarCollapsed" class="ml-3">Settings</span>
            </a>
          </nav>
          
          <!-- WordPress-style Collapse Button at Bottom -->
          <div class="p-4 border-t border-gray-200 mt-auto">
            <button 
              (click)="toggleSidebar()" 
              class="w-full flex items-center px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors group"
              [class.justify-center]="sidebarCollapsed"
              [attr.aria-label]="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
              [title]="sidebarCollapsed ? 'Expand' : 'Collapse'"
            >
              <svg 
                class="w-5 h-5 flex-shrink-0 transition-transform duration-300" 
                [class.rotate-180]="sidebarCollapsed"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
              <span [class.hidden]="sidebarCollapsed" class="ml-3 text-sm font-medium">{{ sidebarCollapsed ? 'Expand' : 'Collapse' }}</span>
            </button>
          </div>
        </aside>

        <!-- Main Content (scrolls when content is long) -->
        <main class="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 lg:p-6 bg-gray-50 transition-all duration-300 w-full">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  sidebarCollapsed = false;
  showNotifications = false;
  notifications: Notification[] = [];
  unreadCount = 0;
  private subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    // On mobile (< 1024px), sidebar starts collapsed. On desktop, check route
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      this.sidebarCollapsed = true;
    } else {
      this.checkAndCollapseSidebar();
    }

    this.subscriptions.add(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe(() => {
        // On mobile, close sidebar after navigation
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
          this.sidebarCollapsed = true;
        } else {
          this.checkAndCollapseSidebar();
        }
      })
    );

    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
      })
    );

    this.subscriptions.add(
      this.notificationService.notifications$.subscribe(notifications => {
        this.notifications = notifications;
        this.unreadCount = notifications.filter(n => !n.read).length;
      })
    );
  }

  private checkAndCollapseSidebar() {
    const url = this.router.url.split('?')[0];
    // Main pages: sidebar expanded. Detail pages (with :id): sidebar collapsed
    const isMainPage = url === '/dashboard' ||
      url === '/dashboard/settings' ||
      url === '/dashboard/bookings' ||
      url === '/dashboard/bookings/new' ||
      url === '/dashboard/bookings/search' ||
      url === '/dashboard/reports' ||
      url === '/dashboard/admin/users' ||
      url === '/dashboard/admin/suppliers' ||
      url === '/dashboard/admin/payments';
    // Only collapse for detail pages (bookings/:id or bookings/:id/edit)
    const isDetailPage = url.match(/^\/dashboard\/bookings\/[^/]+(\/edit)?$/);
    this.sidebarCollapsed = !isMainPage && !!isDetailPage;
    localStorage.setItem('sidebarCollapsed', String(this.sidebarCollapsed));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-notifications-dropdown]')) {
      this.showNotifications = false;
    }
    // Close sidebar on mobile when clicking outside (overlay handles its own clicks)
    // The overlay click handler will toggle sidebar, so we don't need to handle it here
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    // On desktop, restore sidebar state. On mobile, keep collapsed
    if (event.target.innerWidth >= 1024) {
      this.checkAndCollapseSidebar();
    } else {
      this.sidebarCollapsed = true;
    }
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    // Save preference to localStorage
    localStorage.setItem('sidebarCollapsed', String(this.sidebarCollapsed));
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
  }

  handleNotificationClick(notification: Notification) {
    this.notificationService.markAsRead(notification.id);
    if (notification.link) {
      this.router.navigate([notification.link]);
      this.showNotifications = false;
    }
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead();
  }

  clearNotification(id: string) {
    this.notificationService.clearNotification(id);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  canCreateBooking(): boolean {
    return this.authService.hasAnyRole(['AGENT1', 'AGENT2', 'ACCOUNT', 'ADMIN']);
  }

  canViewReports(): boolean {
    return this.authService.hasAnyRole(['ACCOUNT', 'ADMIN']);
  }

  isAdmin(): boolean {
    return this.authService.hasRole('ADMIN');
  }

  /** Role label for header badge (e.g. Admin, Account, Agent 1) */
  getRoleDisplayLabel(): string {
    const r = this.currentUser?.role;
    if (!r) return '';
    const labels: Record<string, string> = {
      ADMIN: 'Admin',
      ACCOUNT: 'Account',
      AGENT1: 'Agent 1',
      AGENT2: 'Agent 2'
    };
    return labels[r] || r;
  }

  /** Sidebar dashboard link text by role (e.g. Admin Dashboard, Account Dashboard) */
  getDashboardLabel(): string {
    const r = this.currentUser?.role;
    if (!r) return 'Dashboard';
    const labels: Record<string, string> = {
      ADMIN: 'Admin Dashboard',
      ACCOUNT: 'Account Dashboard',
      AGENT1: 'Agent 1 Dashboard',
      AGENT2: 'Agent 2 Dashboard'
    };
    return labels[r] || 'Dashboard';
  }

  /** Label above sidebar menu: Admin Dashboard / Account Manager / Agent 1 / Agent 2 */
  getSidebarRoleLabel(): string {
    const r = this.currentUser?.role;
    if (!r) return '';
    const labels: Record<string, string> = {
      ADMIN: 'Admin Dashboard',
      ACCOUNT: 'Account Manager',
      AGENT1: 'Agent 1',
      AGENT2: 'Agent 2'
    };
    return labels[r] || '';
  }
}
