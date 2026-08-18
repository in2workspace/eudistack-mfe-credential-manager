import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { OrganizationContactComponent } from './organization-contact.component';
import { OrganizationContactService } from '../../core/services/organization-contact.service';
import { OrganizationContact } from '../../core/models/entity/organization-contact';
import { AuthService } from '../../core/services/auth.service';

const ORG_ID = 'org-123';

/**
 * Component tests for {@link OrganizationContactComponent}.
 *
 * @since EUD-226 (Task 26, rewritten Task 33 with Jest idiom — was Jasmine
 * syntax under the Jest runner, TS2694, both suites failed to compile)
 */
describe('OrganizationContactComponent', () => {
  let component: OrganizationContactComponent;
  let fixture: ComponentFixture<OrganizationContactComponent>;
  let mockContactService: jest.Mocked<Pick<OrganizationContactService, 'fetchContact' | 'updateContact'>>;
  let mockAuthService: { organizationIdentifier: jest.Mock };

  beforeEach(async () => {
    mockContactService = {
      fetchContact: jest.fn(),
      updateContact: jest.fn()
    };
    mockAuthService = {
      organizationIdentifier: jest.fn().mockReturnValue(ORG_ID)
    };

    await TestBed.configureTestingModule({
      imports: [OrganizationContactComponent, ReactiveFormsModule, TranslateModule.forRoot()],
      providers: [
        { provide: OrganizationContactService, useValue: mockContactService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationContactComponent);
    component = fixture.componentInstance;
  });

  describe('ngOnInit', () => {
    it('should render email when contact exists (AC-01)', () => {
      // Given
      const contact: OrganizationContact = { email: 'existing@example.com' };
      mockContactService.fetchContact.mockReturnValue(of(contact));

      // When
      fixture.detectChanges(); // triggers ngOnInit

      // Then
      expect(mockContactService.fetchContact).toHaveBeenCalledWith(ORG_ID);
      expect(component.contactForm.value.email).toBe('existing@example.com');
      expect(component.loading()).toBe(false);
    });

    it('should render empty field when no contact exists (EC-01)', () => {
      // Given
      const contact: OrganizationContact = { email: null };
      mockContactService.fetchContact.mockReturnValue(of(contact));

      // When
      fixture.detectChanges();

      // Then
      expect(component.contactForm.value.email).toBe('');
      expect(component.loading()).toBe(false);
    });

    it('should show error message when load fails (ES-04)', () => {
      // Given
      mockContactService.fetchContact.mockReturnValue(
        throwError(() => new Error('Server error'))
      );

      // When
      fixture.detectChanges();

      // Then
      expect(component.loading()).toBe(false);
      expect(component.errorMessage()).toBe('organization-contact.error.load-failed');
    });
  });

  describe('onSubmit', () => {
    beforeEach(() => {
      mockContactService.fetchContact.mockReturnValue(of({ email: null }));
      fixture.detectChanges();
    });

    it('should do nothing when form invalid (ES-01)', () => {
      // Given
      component.contactForm.patchValue({ email: '' }); // Invalid: required
      component.contactForm.markAllAsTouched();

      // When
      component.onSubmit();

      // Then
      expect(mockContactService.updateContact).not.toHaveBeenCalled();
    });

    it('should reject invalid email format (ES-01)', () => {
      // Given
      component.contactForm.patchValue({ email: 'invalid-email' });

      // When
      component.onSubmit();

      // Then
      expect(component.contactForm.invalid).toBe(true);
      expect(component.emailControl.hasError('email')).toBe(true);
      expect(mockContactService.updateContact).not.toHaveBeenCalled();
    });

    it('should update and show success when valid (AC-02)', () => {
      // Given
      const validEmail = 'valid@example.com';
      component.contactForm.patchValue({ email: validEmail });
      mockContactService.updateContact.mockReturnValue(of(undefined));

      // When
      component.onSubmit();

      // Then
      expect(mockContactService.updateContact).toHaveBeenCalledWith(
        ORG_ID,
        validEmail
      );
      expect(component.successMessage()).toBe('organization-contact.success.update');
      expect(component.loading()).toBe(false);
    });

    it('should show error message when update fails (ES-05)', () => {
      // Given
      component.contactForm.patchValue({ email: 'test@example.com' });
      mockContactService.updateContact.mockReturnValue(
        throwError(() => new Error('Server error'))
      );

      // When
      component.onSubmit();

      // Then
      expect(component.errorMessage()).toBe('organization-contact.error.update-failed');
      expect(component.loading()).toBe(false);
    });
  });
});
