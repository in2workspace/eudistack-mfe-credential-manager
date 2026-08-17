import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { OrganizationContactComponent } from './organization-contact.component';
import { OrganizationContactService } from '../../core/services/organization-contact.service';
import { OrganizationContact } from '../../core/models/entity/organization-contact';

/**
 * Component tests for {@link OrganizationContactComponent}.
 *
 * @since EUD-226 (Task 26)
 */
describe('OrganizationContactComponent', () => {
  let component: OrganizationContactComponent;
  let fixture: ComponentFixture<OrganizationContactComponent>;
  let mockContactService: jasmine.SpyObj<OrganizationContactService>;

  beforeEach(async () => {
    mockContactService = jasmine.createSpyObj('OrganizationContactService', [
      'fetchContact',
      'updateContact'
    ]);

    await TestBed.configureTestingModule({
      imports: [OrganizationContactComponent, ReactiveFormsModule],
      providers: [
        { provide: OrganizationContactService, useValue: mockContactService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationContactComponent);
    component = fixture.componentInstance;
  });

  describe('ngOnInit', () => {
    it('should render email when contact exists (AC-01)', () => {
      // Given
      const contact: OrganizationContact = { email: 'existing@example.com' };
      mockContactService.fetchContact.and.returnValue(of(contact));

      // When
      fixture.detectChanges(); // triggers ngOnInit

      // Then
      expect(component.contactForm.value.email).toBe('existing@example.com');
      expect(component.loading()).toBe(false);
    });

    it('should render empty field when no contact exists (EC-01)', () => {
      // Given
      const contact: OrganizationContact = { email: null };
      mockContactService.fetchContact.and.returnValue(of(contact));

      // When
      fixture.detectChanges();

      // Then
      expect(component.contactForm.value.email).toBe('');
      expect(component.loading()).toBe(false);
    });

    it('should show error message when load fails (ES-04)', () => {
      // Given
      mockContactService.fetchContact.and.returnValue(
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
      mockContactService.fetchContact.and.returnValue(of({ email: null }));
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
      mockContactService.updateContact.and.returnValue(of(undefined));

      // When
      component.onSubmit();

      // Then
      expect(mockContactService.updateContact).toHaveBeenCalledWith(
        component['orgId'],
        validEmail
      );
      expect(component.successMessage()).toBe('organization-contact.success.update');
      expect(component.loading()).toBe(false);
    });

    it('should show error message when update fails (ES-05)', () => {
      // Given
      component.contactForm.patchValue({ email: 'test@example.com' });
      mockContactService.updateContact.and.returnValue(
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
