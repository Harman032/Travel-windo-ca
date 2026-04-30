import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserService, User } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-7xl mx-auto">
      <div class="page-title-card flex justify-between items-center">
        <h2 class="page-title">Manage Users</h2>
        <button 
          (click)="showAddForm = !showAddForm" 
          class="btn-on-gradient flex items-center gap-2"
          [title]="showAddForm ? 'Cancel' : 'Add New User'"
        >
          <svg *ngIf="!showAddForm" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <svg *ngIf="showAddForm" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          {{ showAddForm ? 'Cancel' : 'Add New User' }}
        </button>
      </div>

      <!-- Add/Edit User Form -->
      <div *ngIf="showAddForm || editingUser || passwordFormUser" class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">{{ passwordFormUser ? 'Update Password' : (editingUser ? 'Edit User' : 'Add New User') }}</h3>
        <ng-container *ngIf="passwordFormUser; else userFormTemplate">
          <p class="text-sm text-gray-600 mb-4">Set new password for {{ passwordFormUser.name }} ({{ passwordFormUser.email }})</p>
          <form [formGroup]="passwordForm" (ngSubmit)="onSubmitPassword()">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">New password <span class="text-red-500">*</span></label>
                <div class="relative">
                  <input
                    [type]="showNewPassword ? 'text' : 'password'"
                    formControlName="newPassword"
                    class="input pr-10"
                    placeholder="Enter new password"
                    autocomplete="new-password"
                    [class.border-red-500]="passwordForm.get('newPassword')?.invalid && passwordForm.get('newPassword')?.touched"
                  />
                  <button
                    type="button"
                    (click)="showNewPassword = !showNewPassword"
                    class="absolute flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700"
                    style="right: 10px; left: auto; top: 50%; transform: translateY(-50%);"
                    tabindex="-1"
                  >
                    <svg *ngIf="!showNewPassword" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    <svg *ngIf="showNewPassword" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  </button>
                </div>
                <p *ngIf="passwordForm.get('newPassword')?.errors?.['minlength'] && passwordForm.get('newPassword')?.touched" class="text-red-500 text-xs mt-1">At least 6 characters</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Confirm password <span class="text-red-500">*</span></label>
                <div class="relative">
                  <input
                    [type]="showConfirmPassword ? 'text' : 'password'"
                    formControlName="confirmPassword"
                    class="input pr-10"
                    placeholder="Confirm new password"
                    autocomplete="new-password"
                    [class.border-red-500]="passwordForm.get('confirmPassword')?.invalid && passwordForm.get('confirmPassword')?.touched"
                  />
                  <button
                    type="button"
                    (click)="showConfirmPassword = !showConfirmPassword"
                    class="absolute flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700"
                    style="right: 10px; left: auto; top: 50%; transform: translateY(-50%);"
                    tabindex="-1"
                  >
                    <svg *ngIf="!showConfirmPassword" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    <svg *ngIf="showConfirmPassword" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  </button>
                </div>
                <p *ngIf="passwordForm.errors?.['passwordMismatch'] && passwordForm.get('confirmPassword')?.touched" class="text-red-500 text-xs mt-1">Passwords do not match</p>
              </div>
            </div>
            <div class="mt-4 flex justify-end space-x-2">
              <button
                type="button"
                (click)="closePasswordForm()"
                class="btn btn-secondary flex items-center gap-2"
                title="Cancel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
              <button type="submit" class="btn btn-primary flex items-center gap-2" [disabled]="passwordForm.invalid || savingPassword">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                {{ savingPassword ? 'Updating...' : 'Update Password' }}
              </button>
            </div>
          </form>
        </ng-container>
        <ng-template #userFormTemplate>
        <form [formGroup]="userForm" (ngSubmit)="onSubmit()">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Name <span class="text-red-500">*</span></label>
              <input type="text" formControlName="name" class="input" placeholder="Enter name" [class.border-red-500]="userForm.get('name')?.invalid && userForm.get('name')?.touched" />
              <p *ngIf="userForm.get('name')?.invalid && userForm.get('name')?.touched" class="text-red-500 text-xs mt-1">Name is required</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email <span class="text-red-500">*</span></label>
              <input type="email" formControlName="email" class="input" placeholder="Enter email" [class.border-red-500]="userForm.get('email')?.invalid && userForm.get('email')?.touched" />
              <p *ngIf="userForm.get('email')?.invalid && userForm.get('email')?.touched" class="text-red-500 text-xs mt-1">
                {{ userForm.get('email')?.errors?.['required'] ? 'Email is required' : 'Enter a valid email' }}
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Role <span class="text-red-500">*</span></label>
              <select formControlName="role" class="input" [class.border-red-500]="userForm.get('role')?.invalid && userForm.get('role')?.touched">
                <option value="">Select Role</option>
                <option value="AGENT1">Agent 1</option>
                <option value="AGENT2">Agent 2</option>
                <option value="ACCOUNT">Account</option>
                <option value="ADMIN">Admin</option>
              </select>
              <p *ngIf="userForm.get('role')?.invalid && userForm.get('role')?.touched" class="text-red-500 text-xs mt-1">Please select a role</p>
            </div>
            <div *ngIf="!editingUser">
              <label class="block text-sm font-medium text-gray-700 mb-1">Password <span class="text-red-500">*</span></label>
              <input type="password" formControlName="password" class="input" placeholder="Enter password" [class.border-red-500]="userForm.get('password')?.invalid && userForm.get('password')?.touched" />
              <p *ngIf="userForm.get('password')?.invalid && userForm.get('password')?.touched" class="text-red-500 text-xs mt-1">Password is required for new users</p>
            </div>
            <div *ngIf="editingUser" class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-700">Status</span>
              <button
                type="button"
                role="switch"
                [attr.aria-checked]="userForm.get('isActive')?.value"
                (click)="userForm.patchValue({ isActive: !userForm.get('isActive')?.value })"
                class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#38bdf8] focus:ring-offset-2"
                [class.bg-gray-200]="!userForm.get('isActive')?.value"
                [class.toggle-active]="userForm.get('isActive')?.value"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
                  [class.translate-x-5]="userForm.get('isActive')?.value"
                  [class.translate-x-0.5]="!userForm.get('isActive')?.value"
                ></span>
              </button>
              <span class="text-sm text-gray-600">{{ userForm.get('isActive')?.value ? 'Active' : 'Inactive' }}</span>
            </div>
          </div>
          <div class="mt-4 flex justify-end space-x-2">
            <button 
              type="button" 
              (click)="cancelForm()" 
              class="btn btn-secondary flex items-center gap-2"
              title="Cancel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <button 
              type="submit" 
              class="btn btn-primary flex items-center gap-2" 
              [title]="editingUser ? 'Update User' : 'Create User'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {{ editingUser ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
        </ng-template>
      </div>

      <!-- Users Table -->
      <div class="card">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Users List</h3>
        <div class="overflow-x-auto -mx-3 sm:mx-0">
          <div class="inline-block min-w-full align-middle">
            <!-- Loading skeleton -->
            <table *ngIf="loading" class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-14">Profile</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr *ngFor="let i of [1,2,3,4,5]" class="animate-pulse">
                  <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-circle w-10 h-10 rounded-full"></div></td>
                  <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-24 h-4"></div></td>
                  <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-32 h-4"></div></td>
                  <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-16 h-4"></div></td>
                  <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-20 h-4"></div></td>
                  <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-24 h-4"></div></td>
                </tr>
              </tbody>
            </table>
            <!-- Actual table -->
            <table *ngIf="!loading" class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-14">Profile</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr *ngFor="let user of users" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 border border-gray-200"
                    [style.backgroundColor]="!user.photo ? getAvatarColor(user.name).bg : null"
                    [style.color]="!user.photo ? getAvatarColor(user.name).text : null">
                    <img *ngIf="user.photo" [src]="user.photo" alt="" class="w-full h-full object-cover" />
                    <span *ngIf="!user.photo" class="text-sm font-semibold">{{ getInitials(user.name) }}</span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ user.name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ user.email }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span class="badge" [ngClass]="getRoleClass(user.role)">
                    {{ user.role }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      [attr.aria-checked]="user.isActive !== false"
                      [attr.aria-label]="(user.isActive !== false ? 'Deactivate' : 'Activate') + ' ' + user.name"
                      [title]="user._id === currentUserId ? 'You cannot change your own active status' : ''"
                      (click)="toggleActive(user)"
                      [disabled]="togglingUserId === user._id || user._id === currentUserId"
                      class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#38bdf8] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      [class.bg-gray-200]="user.isActive === false"
                      [class.toggle-active]="user.isActive !== false"
                    >
                      <span
                        class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
                        [class.translate-x-5]="user.isActive !== false"
                        [class.translate-x-0.5]="user.isActive === false"
                      ></span>
                    </button>
                    <span class="text-gray-600 text-xs">{{ user.isActive !== false ? 'Active' : 'Inactive' }}</span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex items-center gap-2 flex-wrap">
                    <button 
                      (click)="editUser(user)" 
                      class="text-primary-600 hover:text-primary-900 flex items-center gap-1 px-2 py-1 rounded transition-colors"
                      title="Edit User"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button 
                      (click)="openPasswordForm(user)" 
                      class="text-amber-600 hover:text-amber-800 flex items-center gap-1 px-2 py-1 rounded transition-colors"
                      title="Update Password"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Password
                    </button>
                    <button 
                      *ngIf="user._id !== currentUserId" 
                      (click)="deleteUser(user)" 
                      class="text-red-600 hover:text-red-900 flex items-center gap-1 px-2 py-1 rounded transition-colors"
                      title="Delete User"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="users.length === 0">
                <td colspan="6" class="px-6 py-4 text-center text-gray-500">No users found</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>

  `
})
export class ManageUsersComponent implements OnInit {
  users: User[] = [];
  loading = true;
  showAddForm = false;
  editingUser: User | null = null;
  userForm: FormGroup;
  passwordFormUser: User | null = null;
  passwordForm: FormGroup;
  savingPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  currentUserId: string | null = null;
  togglingUserId: string | null = null;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: ['', Validators.required],
      password: [''],
      isActive: [true]
    });

    this.passwordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: (g) => {
      const np = g.get('newPassword')?.value;
      const cp = g.get('confirmPassword')?.value;
      return np && cp && np !== cp ? { passwordMismatch: true } : null;
    } });

    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUserId = user.id;
      }
    });
  }

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onSubmit() {
    if (!this.editingUser) {
      const pw = this.userForm.get('password');
      if (!pw?.value?.trim()) {
        pw?.setErrors({ required: true });
        pw?.markAsTouched();
      }
    }
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      const errors: string[] = [];
      if (this.userForm.get('name')?.errors?.['required']) errors.push('Name is required');
      if (this.userForm.get('email')?.errors?.['required']) errors.push('Email is required');
      if (this.userForm.get('email')?.errors?.['email']) errors.push('Enter a valid email');
      if (this.userForm.get('role')?.errors?.['required']) errors.push('Please select a role');
      if (!this.editingUser && (this.userForm.get('password')?.errors?.['required'] || !this.userForm.get('password')?.value?.trim())) errors.push('Password is required');
      this.toastr.error(errors.length ? errors.join('. ') : 'Please fix the errors in the form', 'Validation Error');
      return;
    }

    const formValue = this.userForm.value;

    if (this.editingUser) {
      // Update user
      const updateData: any = {
        name: formValue.name,
        email: formValue.email,
        role: formValue.role,
        isActive: formValue.isActive
      };

      this.userService.updateUser(this.editingUser._id!, updateData).subscribe({
        next: () => {
          this.toastr.success('User updated successfully', 'Success');
          this.loadUsers();
          this.cancelForm();
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Failed to update user', 'Error');
        }
      });
    } else {
      // Create user
      if (!formValue.password) {
        this.toastr.warning('Password is required for new users', 'Warning');
        return;
      }

      this.userService.createUser({
        name: formValue.name,
        email: formValue.email,
        role: formValue.role,
        password: formValue.password
      }).subscribe({
        next: () => {
          this.toastr.success('User created successfully', 'Success');
          this.loadUsers();
          this.cancelForm();
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Failed to create user', 'Error');
        }
      });
    }
  }

  editUser(user: User) {
    this.editingUser = user;
    this.showAddForm = true;
    this.userForm.patchValue({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive !== false
    });
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();
  }

  toggleActive(user: User) {
    if (this.togglingUserId) return;
    if (user._id === this.currentUserId) {
      this.toastr.warning('You cannot change your own active status', 'Not allowed');
      return;
    }
    const newActive = !(user.isActive !== false);
    this.togglingUserId = user._id!;
    this.userService.updateUser(user._id!, { isActive: newActive }).subscribe({
      next: () => {
        user.isActive = newActive;
        this.toastr.success(`User "${user.name}" is now ${newActive ? 'Active' : 'Inactive'}`, 'Success');
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to update status', 'Error');
      }
    }).add(() => {
      this.togglingUserId = null;
    });
  }

  deleteUser(user: User) {
    Swal.fire({
      title: 'Permanently delete user?',
      text: `"${user.name}" will be permanently removed from the system. This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, permanently delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.userService.deleteUser(user._id!).subscribe({
          next: () => {
            Swal.fire('Deleted!', 'User has been permanently deleted.', 'success');
            this.toastr.success(`User "${user.name}" permanently deleted`, 'Success');
            this.loadUsers();
          },
          error: (err) => {
            Swal.fire('Error!', err.error?.message || 'Failed to delete user', 'error');
            this.toastr.error(err.error?.message || 'Failed to delete user', 'Error');
          }
        });
      }
    });
  }

  cancelForm() {
    this.showAddForm = false;
    this.editingUser = null;
    this.passwordFormUser = null;
    this.userForm.reset();
    this.userForm.get('password')?.setValidators([Validators.required]);
    this.userForm.get('password')?.updateValueAndValidity();
  }

  openPasswordForm(user: User) {
    this.passwordFormUser = user;
    this.showAddForm = true;
    this.editingUser = null;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
    this.passwordForm.reset();
  }

  closePasswordForm() {
    this.passwordFormUser = null;
    this.showAddForm = false;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
    this.passwordForm.reset();
  }

  onSubmitPassword() {
    if (this.passwordForm.invalid || !this.passwordFormUser) return;
    const newPw = this.passwordForm.get('newPassword')?.value?.trim();
    const confirm = this.passwordForm.get('confirmPassword')?.value?.trim();
    if (newPw !== confirm) return;
    this.savingPassword = true;
    this.userService.updateUser(this.passwordFormUser!._id!, { password: newPw }).subscribe({
      next: () => {
        this.toastr.success(`Password updated for ${this.passwordFormUser?.name}`, 'Success');
        this.closePasswordForm();
        this.savingPassword = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to update password', 'Error');
        this.savingPassword = false;
      }
    });
  }

  /** Initials from name: first letter of first word + first letter of last word, or first 2 chars if single word */
  getInitials(name: string): string {
    if (!name || !name.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (name.slice(0, 2) || name[0]).toUpperCase();
  }

  /** Consistent color per name for avatar when no photo (name-based hash) */
  getAvatarColor(name: string): { bg: string; text: string } {
    const palette: { bg: string; text: string }[] = [
      { bg: '#dbeafe', text: '#1d4ed8' },
      { bg: '#e9d5ff', text: '#6b21a8' },
      { bg: '#d1fae5', text: '#047857' },
      { bg: '#fed7aa', text: '#c2410c' },
      { bg: '#fecdd3', text: '#be123c' },
      { bg: '#e0e7ff', text: '#3730a3' },
      { bg: '#fef3c7', text: '#b45309' },
      { bg: '#cffafe', text: '#0e7490' },
      { bg: '#fce7f3', text: '#9d174d' },
      { bg: '#d1fae5', text: '#065f46' },
      { bg: '#0096D2', text: '#ffffff' },
      { bg: '#7c3aed', text: '#ffffff' }
    ];
    let hash = 0;
    const s = (name || '').trim();
    for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash) + s.charCodeAt(i);
    const idx = Math.abs(hash) % palette.length;
    return palette[idx];
  }

  getRoleClass(role: string): string {
    const roleMap: { [key: string]: string } = {
      'AGENT1': 'bg-blue-100 text-blue-800',
      'AGENT2': 'bg-purple-100 text-purple-800',
      'ACCOUNT': 'bg-green-100 text-green-800',
      'ADMIN': 'bg-red-100 text-red-800'
    };
    return roleMap[role] || 'bg-gray-100 text-gray-800';
  }
}
