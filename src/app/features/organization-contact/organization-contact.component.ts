import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { OrganizationContactService } from '../../core/services/organization-contact.service';

/**
 * Component for managing organization contact email.
 *
 * @since EUD-226
 */
@Component({
  selector: 'app-organization-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './organization-contact.component.html',
  styleUrls: ['./organization-contact.component.scss']
})
export class OrganizationContactComponent implements OnInit {
  private readonly contactService = inject(OrganizationContactService);
  private readonly fb = inject(FormBuilder);

  // TODO: Extract orgId from authentication context / route params
  private readonly orgId = 'placeholder-org-id';

  readonly contactForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  readonly loading = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadContact();
  }

  private loadContact(): void {
    this.loading.set(true);
    this.clearMessages();

    this.contactService.fetchContact(this.orgId).subscribe({
      next: (contact) => {
        // EC-01: Empty field if no contact exists
        if (contact.email) {
          this.contactForm.patchValue({ email: contact.email });
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load contact:', err);
        this.errorMessage.set('organization-contact.error.load-failed');
        this.loading.set(false);
      }
    });
  }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    const email = this.contactForm.value.email!;
    this.loading.set(true);
    this.clearMessages();

    this.contactService.updateContact(this.orgId, email).subscribe({
      next: () => {
        this.successMessage.set('organization-contact.success.update');
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to update contact:', err);
        this.errorMessage.set('organization-contact.error.update-failed');
        this.loading.set(false);
      }
    });
  }

  private clearMessages(): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);
  }

  get emailControl() {
    return this.contactForm.controls.email;
  }
}
