import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { ArtifactKind, UncopiedArtifactCloseGuard } from './uncopied-artifact-close-guard';
import { DialogWrapperService } from '../components/dialog/dialog-wrapper/dialog-wrapper.service';

/**
 * EUD-233 Task 36: the four discard paths (backdrop, Esc, secondary control, browser back), the
 * AC-14.3 negative (nothing pending -- no guard at all, AC-10.2's case), and the sentinel's
 * cardinality (exactly one, retired on every terminal close). Isolated from any real host --
 * `pendingArtifacts` is a plain signal this spec controls directly.
 */
describe('UncopiedArtifactCloseGuard', () => {
  let guard: UncopiedArtifactCloseGuard;
  let dialogWrapperMock: { openDialog: jest.Mock };
  let confirmDialogAfterClosed: Subject<boolean | undefined>;
  let dialogRefMock: {
    disableClose: boolean;
    backdropClick: jest.Mock;
    keydownEvents: jest.Mock;
    afterClosed: jest.Mock;
    close: jest.Mock;
  };
  let backdropSubject: Subject<MouseEvent>;
  let keydownSubject: Subject<KeyboardEvent>;
  let closedSubject: Subject<unknown>;
  let pushStateSpy: jest.SpyInstance;
  let backSpy: jest.SpyInstance;

  beforeEach(() => {
    confirmDialogAfterClosed = new Subject<boolean | undefined>();
    dialogWrapperMock = {
      openDialog: jest.fn(() => ({ afterClosed: () => confirmDialogAfterClosed.asObservable() })),
    };

    backdropSubject = new Subject<MouseEvent>();
    keydownSubject = new Subject<KeyboardEvent>();
    closedSubject = new Subject<unknown>();
    dialogRefMock = {
      disableClose: false,
      backdropClick: jest.fn(() => backdropSubject.asObservable()),
      keydownEvents: jest.fn(() => keydownSubject.asObservable()),
      afterClosed: jest.fn(() => closedSubject.asObservable()),
      // Mirrors real MatDialogRef: calling close() is what eventually fires afterClosed().
      close: jest.fn(() => closedSubject.next(undefined)),
    };

    pushStateSpy = jest.spyOn(globalThis.history, 'pushState').mockImplementation(() => {});
    backSpy = jest.spyOn(globalThis.history, 'back').mockImplementation(() => {});

    TestBed.configureTestingModule({
      providers: [
        UncopiedArtifactCloseGuard,
        { provide: DialogWrapperService, useValue: dialogWrapperMock },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    guard = TestBed.inject(UncopiedArtifactCloseGuard);
  });

  afterEach(() => {
    // Each protect() call registers a real `window.addEventListener('popstate', ...)`; without an
    // explicit terminal close, that listener would otherwise leak into later tests and receive
    // their dispatched popstate events too. Idempotent: harmless if the guard already closed itself.
    dialogRefMock.close();
    jest.restoreAllMocks();
  });

  function protectWith(pending: ArtifactKind[]) {
    const pendingArtifacts = signal<readonly ArtifactKind[]>(pending);
    const handle = guard.protect(dialogRefMock as unknown as MatDialogRef<unknown>, pendingArtifacts);
    return { handle, pendingArtifacts };
  }

  it("sets disableClose immediately (belt-and-suspenders with the host's own MatDialogConfig)", () => {
    protectWith(['credential']);
    expect(dialogRefMock.disableClose).toBe(true);
  });

  it('pushes exactly one sentinel history entry on protect()', () => {
    protectWith(['credential']);
    expect(pushStateSpy).toHaveBeenCalledTimes(1);
  });

  describe('with something pending', () => {
    it('backdrop click opens the confirmation and closes only on confirm (AC-14.1)', () => {
      protectWith(['credential']);
      backdropSubject.next({} as MouseEvent);

      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
      expect(dialogRefMock.close).not.toHaveBeenCalled();

      confirmDialogAfterClosed.next(true);
      expect(dialogRefMock.close).toHaveBeenCalledTimes(1);
    });

    it('backdrop click does not close when the confirmation is cancelled (AC-14.2)', () => {
      protectWith(['credential']);
      backdropSubject.next({} as MouseEvent);
      confirmDialogAfterClosed.next(false);

      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('Esc opens the confirmation; any other key does not', () => {
      protectWith(['credential']);
      keydownSubject.next({ key: 'Tab' } as KeyboardEvent);
      expect(dialogWrapperMock.openDialog).not.toHaveBeenCalled();

      keydownSubject.next({ key: 'Escape' } as KeyboardEvent);
      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
    });

    it('requestClose() (the secondary control) opens the confirmation, never closing on its own', () => {
      const { handle } = protectWith(['privateKey']);
      handle.requestClose();

      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('names both artifacts when both are pending (AC-14.1)', () => {
      protectWith(['credential', 'privateKey']);
      backdropSubject.next({} as MouseEvent);

      const [, dialogData] = dialogWrapperMock.openDialog.mock.calls[0];
      expect(dialogData.message).toBe('credentialIssuance.discardArtifactsConfirm.both');
    });

    it('names only the credential when only it is pending', () => {
      protectWith(['credential']);
      backdropSubject.next({} as MouseEvent);

      const [, dialogData] = dialogWrapperMock.openDialog.mock.calls[0];
      expect(dialogData.message).toBe('credentialIssuance.discardArtifactsConfirm.credential');
    });

    it('names only the private key when only it is pending', () => {
      protectWith(['privateKey']);
      backdropSubject.next({} as MouseEvent);

      const [, dialogData] = dialogWrapperMock.openDialog.mock.calls[0];
      expect(dialogData.message).toBe('credentialIssuance.discardArtifactsConfirm.privateKey');
    });

    it('offers exactly two actions with i18n labels (AC-14.1)', () => {
      protectWith(['credential']);
      backdropSubject.next({} as MouseEvent);

      const [, dialogData] = dialogWrapperMock.openDialog.mock.calls[0];
      expect(dialogData.confirmationType).toBe('sync');
      expect(dialogData.confirmationLabel).toBe('credentialIssuance.discardArtifactsConfirm.confirmationLabel');
      expect(dialogData.cancelLabel).toBe('credentialIssuance.discardArtifactsConfirm.cancelLabel');
    });

    // EUD-233 fix 2026-09-16: "stay here" must read as the safe/primary choice on this
    // destructive-by-default prompt, not "close anyway".
    it('emphasizes the cancel ("stay here") action over the confirm ("close anyway") one', () => {
      protectWith(['credential']);
      backdropSubject.next({} as MouseEvent);

      const [, dialogData] = dialogWrapperMock.openDialog.mock.calls[0];
      expect(dialogData.emphasizeCancel).toBe(true);
    });

    it('browser back re-arms the sentinel and opens the confirmation, without closing unconfirmed', () => {
      protectWith(['credential']);
      pushStateSpy.mockClear();

      globalThis.dispatchEvent(new PopStateEvent('popstate'));

      expect(pushStateSpy).toHaveBeenCalledTimes(1);
      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('confirming after a browser back closes the dialog', () => {
      protectWith(['credential']);

      globalThis.dispatchEvent(new PopStateEvent('popstate'));
      confirmDialogAfterClosed.next(true);

      expect(dialogRefMock.close).toHaveBeenCalledTimes(1);
    });

    it('cancelling after a browser back leaves the dialog open, still guarded for a second "atrás"', () => {
      protectWith(['credential']);

      globalThis.dispatchEvent(new PopStateEvent('popstate'));
      confirmDialogAfterClosed.next(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();

      dialogWrapperMock.openDialog.mockClear();
      globalThis.dispatchEvent(new PopStateEvent('popstate'));
      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
    });
  });

  describe('nothing pending (AC-14.3 negative, AC-10.2)', () => {
    it('backdrop click closes directly, no confirmation', () => {
      protectWith([]);
      backdropSubject.next({} as MouseEvent);

      expect(dialogWrapperMock.openDialog).not.toHaveBeenCalled();
      expect(dialogRefMock.close).toHaveBeenCalledTimes(1);
    });

    it('Esc closes directly, no confirmation', () => {
      protectWith([]);
      keydownSubject.next({ key: 'Escape' } as KeyboardEvent);

      expect(dialogWrapperMock.openDialog).not.toHaveBeenCalled();
      expect(dialogRefMock.close).toHaveBeenCalledTimes(1);
    });

    it('requestClose() closes directly, no confirmation', () => {
      const { handle } = protectWith([]);
      handle.requestClose();

      expect(dialogWrapperMock.openDialog).not.toHaveBeenCalled();
      expect(dialogRefMock.close).toHaveBeenCalledTimes(1);
    });

    it('browser back lets the navigation stand and closes directly -- no confirmation, no re-push', () => {
      protectWith([]);
      pushStateSpy.mockClear();

      globalThis.dispatchEvent(new PopStateEvent('popstate'));

      expect(pushStateSpy).not.toHaveBeenCalled();
      expect(dialogWrapperMock.openDialog).not.toHaveBeenCalled();
      expect(dialogRefMock.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('sentinel hygiene (R-15)', () => {
    // EUD-233 fix 2026-09-17: history.back() on every terminal close raced the host's own
    // post-close router.navigate() -- back() is a real, asynchronous browser navigation, so it
    // could resolve AFTER the router had already pushed the new URL, undoing that push and
    // stranding the operator back on the sentinel entry (the same, now-reset form). It must now
    // fire ONLY when completing a real interrupted back-navigation, never on a "normal" close.
    it('does NOT call history.back() on a plain terminal close (Done) -- nothing to complete, avoids racing a forward navigation', () => {
      protectWith(['credential']);

      dialogRefMock.close();

      expect(backSpy).not.toHaveBeenCalled();
    });

    it('does NOT call history.back() when the secondary close control closes directly (nothing pending)', () => {
      const { handle } = protectWith([]);
      handle.requestClose();

      expect(backSpy).not.toHaveBeenCalled();
    });

    it('does NOT call history.back() when a backdrop discard is confirmed -- no real navigation was ever in flight', () => {
      protectWith(['credential']);
      backdropSubject.next({} as MouseEvent);
      confirmDialogAfterClosed.next(true);

      expect(backSpy).not.toHaveBeenCalled();
    });

    it('DOES call history.back() to complete a real browser back-navigation the operator confirmed discarding through', () => {
      protectWith(['credential']);

      globalThis.dispatchEvent(new PopStateEvent('popstate'));
      confirmDialogAfterClosed.next(true);

      expect(backSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT call history.back() when the operator cancels the real-back discard and later closes normally (Done)', () => {
      protectWith(['credential']);

      globalThis.dispatchEvent(new PopStateEvent('popstate'));
      confirmDialogAfterClosed.next(false); // stays on the surface, sentinel remains but guards nothing in flight anymore

      dialogRefMock.close(); // e.g. "Done", once everything gets copied afterwards

      expect(backSpy).not.toHaveBeenCalled();
    });

    it('does not call history.back() again when the sentinel was already consumed by a real back with nothing pending', () => {
      protectWith([]);

      globalThis.dispatchEvent(new PopStateEvent('popstate')); // consumes the sentinel, closes directly

      expect(backSpy).not.toHaveBeenCalled();
    });

    it('removes the popstate listener on close, so a later back does not re-trigger the guard', () => {
      protectWith(['credential']);
      dialogRefMock.close();

      globalThis.dispatchEvent(new PopStateEvent('popstate'));

      expect(dialogWrapperMock.openDialog).not.toHaveBeenCalled();
    });
  });
});
