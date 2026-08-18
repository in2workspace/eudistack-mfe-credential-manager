import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { OrganizationContactService } from '../../core/services/organization-contact.service';
import { AuthService } from '../../core/services/auth.service';

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
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  // Set by the backend's `/me` verdict (`AuthService.organizationIdentifier`), already
  // resolved by the time this component activates: `organizationContactGuard` awaits
  // `resolveRole$()` before allowing the route, and that signal is populated in the
  // same round trip, ahead of `resolvedRole`.
  private get orgId(): string {
    return this.authService.organizationIdentifier();
  }

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

    this.contactService.fetchContact(this.orgId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
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

    this.contactService.updateContact(this.orgId, email).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
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
