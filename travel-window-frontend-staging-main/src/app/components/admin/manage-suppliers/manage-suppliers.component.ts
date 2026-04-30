import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { SupplierService, Supplier } from '../../../services/supplier.service';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-manage-suppliers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-7xl mx-auto">
      <div class="page-title-card flex justify-between items-center">
        <h2 class="page-title">Manage Suppliers</h2>
        <button 
          (click)="showAddForm = !showAddForm" 
          class="btn-on-gradient flex items-center gap-2"
          [title]="showAddForm ? 'Cancel' : 'Add New Supplier'"
        >
          <svg *ngIf="!showAddForm" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <svg *ngIf="showAddForm" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          {{ showAddForm ? 'Cancel' : 'Add New Supplier' }}
        </button>
      </div>

      <!-- Add/Edit Supplier Form -->
      <div *ngIf="showAddForm || editingSupplier" class="card mb-6">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">{{ editingSupplier ? 'Edit Supplier' : 'Add New Supplier' }}</h3>
        <form [formGroup]="supplierForm" (ngSubmit)="onSubmit()">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Supplier Name <span class="text-red-500">*</span></label>
              <input type="text" formControlName="name" class="input" placeholder="Enter supplier name" [class.border-red-500]="supplierForm.get('name')?.invalid && supplierForm.get('name')?.touched" />
              <p *ngIf="supplierForm.get('name')?.invalid && supplierForm.get('name')?.touched" class="text-red-500 text-xs mt-1">Supplier name is required</p>
            </div>
            <div class="flex items-center">
              <input type="checkbox" formControlName="isActive" id="isActive" class="mr-2 h-4 w-4 rounded border-gray-300 accent-button focus:ring-2 focus:ring-button focus:ring-offset-0" />
              <label for="isActive" class="text-sm font-medium text-gray-700">Active</label>
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
              [disabled]="supplierForm.invalid"
              [title]="editingSupplier ? 'Update Supplier' : 'Create Supplier'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {{ editingSupplier ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Suppliers Table -->
      <div class="card">
        <h3 class="text-xl font-semibold mb-4 text-gray-700">Suppliers List</h3>
        <div class="overflow-x-auto -mx-3 sm:mx-0">
          <div class="inline-block min-w-full align-middle">
            <!-- Loading skeleton -->
            <table *ngIf="loading" class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr *ngFor="let i of [1,2,3,4,5]" class="animate-pulse">
                  <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-32 h-4"></div></td>
                  <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-16 h-4"></div></td>
                  <td class="px-6 py-4 whitespace-nowrap"><div class="skeleton-line w-24 h-4"></div></td>
                </tr>
              </tbody>
            </table>
            <!-- Actual table -->
            <table *ngIf="!loading" class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr *ngFor="let supplier of suppliers" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ supplier.name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span class="badge" [ngClass]="supplier.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
                    {{ supplier.isActive !== false ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex items-center gap-2">
                    <button 
                      (click)="editSupplier(supplier)" 
                      class="text-primary-600 hover:text-primary-900 flex items-center gap-1 px-2 py-1 rounded transition-colors"
                      title="Edit Supplier"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button 
                      (click)="deleteSupplier(supplier)" 
                      class="text-red-600 hover:text-red-900 flex items-center gap-1 px-2 py-1 rounded transition-colors"
                      title="Delete Supplier"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="suppliers.length === 0">
                <td colspan="3" class="px-6 py-4 text-center text-gray-500">No suppliers found</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ManageSuppliersComponent implements OnInit {
  suppliers: Supplier[] = [];
  loading = true;
  showAddForm = false;
  editingSupplier: Supplier | null = null;
  supplierForm: FormGroup;

  constructor(
    private supplierService: SupplierService,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) {
    this.supplierForm = this.fb.group({
      name: ['', Validators.required],
      isActive: [true]
    });
  }

  ngOnInit() {
    this.loadSuppliers();
  }

  loadSuppliers() {
    this.loading = true;
    this.supplierService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.suppliers = suppliers;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onSubmit() {
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      return;
    }

    const formValue = this.supplierForm.value;

    if (this.editingSupplier) {
      // Update supplier
      this.supplierService.updateSupplier(this.editingSupplier._id!, {
        name: formValue.name,
        isActive: formValue.isActive
      }).subscribe({
        next: () => {
          this.toastr.success('Supplier updated successfully', 'Success');
          this.loadSuppliers();
          this.cancelForm();
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Failed to update supplier', 'Error');
        }
      });
    } else {
      // Create supplier
      this.supplierService.createSupplier({
        name: formValue.name,
        isActive: formValue.isActive
      }).subscribe({
        next: () => {
          this.toastr.success('Supplier created successfully', 'Success');
          this.loadSuppliers();
          this.cancelForm();
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Failed to create supplier', 'Error');
        }
      });
    }
  }

  editSupplier(supplier: Supplier) {
    this.editingSupplier = supplier;
    this.showAddForm = true;
    this.supplierForm.patchValue({
      name: supplier.name,
      isActive: supplier.isActive !== false
    });
  }

  deleteSupplier(supplier: Supplier) {
    Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to delete supplier "${supplier.name}"? This action cannot be undone!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.supplierService.deleteSupplier(supplier._id!).subscribe({
          next: () => {
            Swal.fire('Deleted!', 'Supplier has been deleted successfully.', 'success');
            this.toastr.success(`Supplier "${supplier.name}" deleted successfully`, 'Success');
            this.loadSuppliers();
          },
          error: (err) => {
            Swal.fire('Error!', err.error?.message || 'Failed to delete supplier', 'error');
            this.toastr.error(err.error?.message || 'Failed to delete supplier', 'Error');
          }
        });
      }
    });
  }

  cancelForm() {
    this.showAddForm = false;
    this.editingSupplier = null;
    this.supplierForm.reset();
    this.supplierForm.patchValue({ isActive: true });
  }
}
