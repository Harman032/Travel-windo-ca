import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { BookingService } from './booking.service';
import { AuthService } from './auth.service';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();
  private readonly READ_NOTIFICATIONS_KEY = 'readNotifications';
  private readonly CLEARED_NOTIFICATIONS_KEY = 'clearedNotifications';
  private pollInterval: any;
  private authSub: Subscription;

  constructor(
    private bookingService: BookingService,
    private authService: AuthService
  ) {
    this.authSub = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.startPolling();
      } else {
        this.stopPolling();
      }
    });
  }

  private startPolling() {
    if (!this.pollInterval) {
      this.loadNotifications();
      // Poll for new notifications every 60 seconds
      this.pollInterval = setInterval(() => this.loadNotifications(), 60000);
    }
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    // Optionally clear current notifications if logged out
    this.notificationsSubject.next([]);
  }

  ngOnDestroy() {
    this.stopPolling();
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }

  private getReadNotifications(): Set<string> {
    const stored = localStorage.getItem(this.READ_NOTIFICATIONS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  }

  private getClearedNotifications(): Set<string> {
    const stored = localStorage.getItem(this.CLEARED_NOTIFICATIONS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  }

  private saveReadNotifications(readSet: Set<string>) {
    localStorage.setItem(this.READ_NOTIFICATIONS_KEY, JSON.stringify(Array.from(readSet)));
  }

  private saveClearedNotifications(clearedSet: Set<string>) {
    localStorage.setItem(this.CLEARED_NOTIFICATIONS_KEY, JSON.stringify(Array.from(clearedSet)));
  }

  private loadNotifications() {
    const readNotifications = this.getReadNotifications();
    const clearedNotifications = this.getClearedNotifications();

    // Get pending verification bookings
    this.bookingService.getBookings({ status: 'Pending Verification', limit: 10 }).subscribe({
      next: (response) => {
        const notifications: Notification[] = response.bookings
          .map((booking) => ({
            id: `pending-${booking._id}`,
            type: 'warning' as const,
            title: 'Pending Verification',
            message: `Booking ${booking.pnr} by ${booking.paxName} is pending verification`,
            timestamp: booking.dateOfSubmission ? new Date(booking.dateOfSubmission) : new Date(),
            read: readNotifications.has(`pending-${booking._id}`),
            link: `/dashboard/bookings/${booking._id}`
          }))
          .filter(n => !clearedNotifications.has(n.id));

        // Get unticketed bookings
        this.bookingService.getBookings({ status: 'Unticketed', limit: 10 }).subscribe({
          next: (unticketedResponse) => {
            const unticketedNotifications: Notification[] = unticketedResponse.bookings
              .map((booking) => ({
                id: `unticketed-${booking._id}`,
                type: 'info' as const,
                title: 'Unticketed Booking',
                message: `Booking ${booking.pnr} is unticketed and needs attention`,
                timestamp: booking.dateOfSubmission ? new Date(booking.dateOfSubmission) : new Date(),
                read: readNotifications.has(`unticketed-${booking._id}`),
                link: `/dashboard/bookings/${booking._id}`
              }))
              .filter(n => !clearedNotifications.has(n.id));

            const allNotifications = [...notifications, ...unticketedNotifications]
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
              .slice(0, 20); // Limit to 20 most recent

            this.notificationsSubject.next(allNotifications);
          }
        });
      }
    });
  }

  getUnreadCount(): Observable<number> {
    return new Observable(observer => {
      this.notifications$.subscribe(notifications => {
        const count = notifications.filter(n => !n.read).length;
        observer.next(count);
      });
    });
  }

  markAsRead(id: string) {
    const notifications = this.notificationsSubject.value;
    const index = notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications[index].read = true;
      this.notificationsSubject.next([...notifications]);
      
      // Persist to localStorage
      const readNotifications = this.getReadNotifications();
      readNotifications.add(id);
      this.saveReadNotifications(readNotifications);
    }
  }

  markAllAsRead() {
    const notifications = this.notificationsSubject.value.map(n => ({ ...n, read: true }));
    this.notificationsSubject.next(notifications);
    
    // Persist to localStorage
    const readNotifications = this.getReadNotifications();
    notifications.forEach(n => readNotifications.add(n.id));
    this.saveReadNotifications(readNotifications);
  }

  clearNotification(id: string) {
    const notifications = this.notificationsSubject.value.filter(n => n.id !== id);
    this.notificationsSubject.next(notifications);
    
    // Persist to localStorage
    const clearedNotifications = this.getClearedNotifications();
    clearedNotifications.add(id);
    this.saveClearedNotifications(clearedNotifications);
  }

  clearAll() {
    const currentNotifications = this.notificationsSubject.value;
    this.notificationsSubject.next([]);
    
    // Persist all current notification IDs as cleared
    const clearedNotifications = this.getClearedNotifications();
    currentNotifications.forEach(n => clearedNotifications.add(n.id));
    this.saveClearedNotifications(clearedNotifications);
  }
}
