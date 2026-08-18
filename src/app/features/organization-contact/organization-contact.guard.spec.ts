import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { organizationContactGuard } from './organization-contact.guard';
import { AuthService } from 'src/app/core/services/auth.service';

/**
 * Unit tests for {@link organizationContactGuard}.
 *
 * @since EUD-226 (Task 27, rewritten Task 33 to exercise the real
 * AuthService-backed guard instead of hardcoded stubs)
 */
describe('organizationContactGuard', () => {
  let mockRouter: { navigate: jest.Mock };
  let mockAuthService: { canAccessOrganizationContact: jest.Mock; canWriteOrganizationContact: jest.Mock };

  const runGuard = () => TestBed.runInInjectionContext(() => organizationContactGuard({} as any, {} as any));

  beforeEach(() => {
    mockRouter = { navigate: jest.fn() };
    mockAuthService = {
      canAccessOrganizationContact: jest.fn(),
      canWriteOrganizationContact: jest.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuthService }
      ]
    });
  });

  it('should allow access when feature enabled and user has write capability (Caso B/C, AC-03, AC-04)', () => {
    // Given
    mockAuthService.canAccessOrganizationContact.mockReturnValue(true);
    mockAuthService.canWriteOrganizationContact.mockReturnValue(true);

    // When
    const result = runGuard();

    // Then
    expect(result).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should deny access when feature disabled (AC-04)', () => {
    // Given
    mockAuthService.canAccessOrganizationContact.mockReturnValue(false);
    mockAuthService.canWriteOrganizationContact.mockReturnValue(true);

    // When
    const result = runGuard();

    // Then
    expect(result).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should deny access when user lacks write capability (Caso A, AC-03, EC-04)', () => {
    // Given
    mockAuthService.canAccessOrganizationContact.mockReturnValue(true);
    mockAuthService.canWriteOrganizationContact.mockReturnValue(false);

    // When
    const result = runGuard();

    // Then
    expect(result).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should allow access when feature enabled and user has write capability (Caso B)', () => {
    // Given: tenant admin in a simple-topology tenant (Caso B) — has action capability
    mockAuthService.canAccessOrganizationContact.mockReturnValue(true);
    mockAuthService.canWriteOrganizationContact.mockReturnValue(true);

    // When
    const result = runGuard();

    // Then
    expect(result).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should allow access when feature enabled and user has write capability (Caso C)', () => {
    // Given: non-admin operator in a multi-org tenant (Caso C) — has action capability
    mockAuthService.canAccessOrganizationContact.mockReturnValue(true);
    mockAuthService.canWriteOrganizationContact.mockReturnValue(true);

    // When
    const result = runGuard();

    // Then
    expect(result).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });
});
