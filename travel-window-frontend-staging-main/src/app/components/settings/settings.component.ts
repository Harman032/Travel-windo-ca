import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, User } from '../../services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-2xl mx-auto">
      <div class="page-title-card">
        <h2 class="page-title">Settings</h2>
        <p class="text-white/90 text-sm mt-1">Update your profile photo, name and password</p>
      </div>

      <div class="space-y-6">
        <!-- Profile Photo -->
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Profile Photo</h3>
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div class="relative">
              <div class="w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center border-2 border-gray-200">
                <img
                  *ngIf="photoPreview || currentUser?.photo"
                  [src]="photoPreview || currentUser?.photo"
                  alt="Profile"
                  class="w-full h-full object-cover"
                />
                <span *ngIf="!photoPreview && !currentUser?.photo" class="text-3xl font-semibold text-gray-500">
                  {{ (currentUser?.name || 'U').charAt(0).toUpperCase() }}
                </span>
              </div>
              <label class="absolute bottom-0 right-0 bg-[#0096D2] text-white rounded-full p-1.5 cursor-pointer shadow hover:bg-[#0080b8]">
                <input
                  type="file"
                  accept=".jpeg,.jpg,.png,image/jpeg,image/jpg,image/png"
                  class="hidden"
                  (change)="onPhotoSelect($event)"
                />
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                </svg>
              </label>
            </div>
            <div class="flex-1">
              <p class="text-sm text-gray-600 mb-2">Upload a photo (.jpeg, .jpg, .png only). Max 2MB.</p>
              <button
                type="button"
                (click)="savePhoto()"
                [disabled]="!pendingPhoto"
                class="btn btn-primary"
              >
                Save Photo
              </button>
            </div>
          </div>
        </div>

        <!-- Name & Email -->
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Profile Info</h3>
          <form [formGroup]="profileForm" (ngSubmit)="saveProfile()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" formControlName="name" class="input" placeholder="Your name" [class.border-red-500]="profileForm.get('name')?.invalid && profileForm.get('name')?.touched" />
              <p *ngIf="profileForm.get('name')?.invalid && profileForm.get('name')?.touched" class="text-red-500 text-xs mt-1">Name is required</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" [value]="currentUser?.email" class="input bg-gray-100" readonly />
              <p class="text-xs text-gray-500 mt-1">Email cannot be changed.</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <input type="text" [value]="currentUser?.role" class="input bg-gray-100" readonly />
            </div>
            <button type="submit" class="btn btn-primary" [disabled]="profileForm.invalid || profileForm.pristine">
              Save Profile
            </button>
          </form>
        </div>

        <!-- Change Password -->
        <div class="card">
          <h3 class="text-lg font-semibold text-gray-800 mb-4">Change Password</h3>
          <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Current Password <span class="text-red-500">*</span></label>
              <input
                type="password"
                formControlName="currentPassword"
                class="input"
                placeholder="Enter current password"
                autocomplete="current-password"
                [class.border-red-500]="passwordForm.get('currentPassword')?.invalid && passwordForm.get('currentPassword')?.touched"
              />
              <p *ngIf="passwordForm.get('currentPassword')?.invalid && passwordForm.get('currentPassword')?.touched" class="text-red-500 text-xs mt-1">
                Required
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">New Password <span class="text-red-500">*</span></label>
              <input
                type="password"
                formControlName="newPassword"
                class="input"
                placeholder="At least 6 characters"
                autocomplete="new-password"
                [class.border-red-500]="passwordForm.get('newPassword')?.invalid && passwordForm.get('newPassword')?.touched"
              />
              <p *ngIf="passwordForm.get('newPassword')?.invalid && passwordForm.get('newPassword')?.touched" class="text-red-500 text-xs mt-1">
                At least 6 characters required
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Confirm New Password <span class="text-red-500">*</span></label>
              <input
                type="password"
                formControlName="confirmPassword"
                class="input"
                placeholder="Confirm new password"
                autocomplete="new-password"
                [class.border-red-500]="(passwordForm.get('confirmPassword')?.invalid || passwordForm.hasError('passwordMismatch')) && passwordForm.get('confirmPassword')?.touched"
              />
              <p *ngIf="passwordForm.get('confirmPassword')?.touched && passwordForm.hasError('passwordMismatch')" class="text-red-500 text-xs mt-1">
                Passwords do not match
              </p>
              <p *ngIf="passwordForm.get('confirmPassword')?.touched && passwordForm.get('confirmPassword')?.invalid && !passwordForm.hasError('passwordMismatch')" class="text-red-500 text-xs mt-1">
                Confirm password is required
              </p>
            </div>
            <button
              type="submit"
              class="btn btn-primary"
              [disabled]="passwordForm.invalid || savingPassword"
            >
              {{ savingPassword ? 'Updating...' : 'Update Password' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent implements OnInit {
  currentUser: User | null = null;
  photoPreview: string | null = null;
  pendingPhoto: string | null = null;
  profileForm: FormGroup;
  passwordForm: FormGroup;
  savingPassword = false;

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1)]]
    });
    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup): { [key: string]: boolean } | null {
    const newP = g.get('newPassword')?.value;
    const confirm = g.get('confirmPassword')?.value;
    if (newP && confirm && newP !== confirm) return { passwordMismatch: true };
    return null;
  }

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUserValue();
    if (this.currentUser) {
      this.profileForm.patchValue({ name: this.currentUser.name });
      if (this.currentUser.photo) this.photoPreview = this.currentUser.photo;
    }
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.profileForm.patchValue({ name: user.name }, { emitEvent: false });
        if (user.photo && !this.pendingPhoto) this.photoPreview = user.photo;
      }
    });
  }

  private readonly allowedPhotoTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  private readonly allowedPhotoExtensions = ['.jpeg', '.jpg', '.png'];

  onPhotoSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const typeOk = this.allowedPhotoTypes.includes(file.type) || this.allowedPhotoExtensions.includes(ext);
    if (!typeOk) {
      this.toastr.warning('Only .jpeg, .jpg and .png images are allowed', 'Invalid file type');
      input.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.toastr.warning('Please choose an image under 2MB', 'File too large');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      this.pendingPhoto = data;
      this.photoPreview = data;
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  savePhoto() {
    const photo = this.pendingPhoto || this.currentUser?.photo || '';
    this.authService.updateProfile({ photo }).subscribe({
      next: () => {
        this.pendingPhoto = null;
        this.toastr.success('Photo updated successfully', 'Success');
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to update photo', 'Error');
      }
    });
  }

  saveProfile() {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    const name = this.profileForm.get('name')?.value?.trim();
    if (!name) return;
    this.authService.updateProfile({ name }).subscribe({
      next: () => {
        this.profileForm.markAsPristine();
        this.toastr.success('Profile updated successfully', 'Success');
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to update profile', 'Error');
      }
    });
  }

  changePassword() {
    if (this.passwordForm.invalid || this.passwordForm.hasError('passwordMismatch')) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const current = this.passwordForm.get('currentPassword')?.value;
    const newP = this.passwordForm.get('newPassword')?.value;
    if (!current || !newP) return;
    this.savingPassword = true;
    this.authService.changePassword(current, newP).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.savingPassword = false;
        this.toastr.success('Password updated successfully', 'Success');
      },
      error: (err) => {
        this.savingPassword = false;
        this.toastr.error(err.error?.message || 'Failed to update password', 'Error');
      }
    });
  }
}
