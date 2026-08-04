import { DestroyRef, inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { CanDeactivateType } from 'src/app/core/guards/can-component-deactivate.guard';

/** Generic "your progress will be lost" prompt, used when a screen has no wording of its own. */
export const DEFAULT_UNSAVED_CHANGES_KEY = 'unsavedChanges.leaveAlert';

/**
 * Shared "the user is about to abandon pending edits" behaviour.
 *
 * Extracted from `CredentialIssuanceService` so every screen that tracks unsaved changes
 * (issuance form, credential catalog) challenges in-app navigation and browser unloads the
 * same way. Each screen keeps ownership of *what counts as a change*: it passes the answer
 * in, this service only decides what to do about it.
 */
@Injectable({ providedIn: 'root' })
export class UnsavedChangesService {
  private readonly translate = inject(TranslateService);

  /** Native confirm rather than a MatDialog: `canDeactivate` has to answer synchronously. */
  public confirmLeave(messageKey: string = DEFAULT_UNSAVED_CHANGES_KEY): boolean {
    return globalThis.confirm(this.translate.instant(messageKey));
  }

  /** Answer for a `canDeactivateGuard`: leave freely, or only after the user confirms. */
  public canDeactivate(hasUnsavedChanges: boolean, messageKey?: string): CanDeactivateType {
    if (!hasUnsavedChanges) return true;
    return this.confirmLeave(messageKey);
  }
}

/**
 * Challenges a browser reload/close while `hasUnsavedChanges()` is true.
 *
 * Must be called from an injection context (field initialiser or constructor); the listener
 * is torn down with the owning component. `preventDefault()` is the whole implementation on
 * purpose — browsers suppress `confirm()` during `beforeunload` and ignore custom messages,
 * so the native "Leave site?" prompt is the only thing that can be triggered from here.
 */
export function guardUnloadWhileUnsaved(hasUnsavedChanges: () => boolean): void {
  const destroyRef = inject(DestroyRef);

  const handler = (event: BeforeUnloadEvent): void => {
    if (hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = true;
    }
  };

  globalThis.addEventListener('beforeunload', handler);
  destroyRef.onDestroy(() => globalThis.removeEventListener('beforeunload', handler));
}
