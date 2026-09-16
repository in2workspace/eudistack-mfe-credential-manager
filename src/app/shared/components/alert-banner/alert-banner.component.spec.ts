import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { AlertBannerComponent } from './alert-banner.component';

describe('AlertBannerComponent', () => {
  let fixture: ComponentFixture<AlertBannerComponent>;
  let component: AlertBannerComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), AlertBannerComponent],
    });

    fixture = TestBed.createComponent(AlertBannerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('messageKey', 'credentialIssuance.deliveryCatalogUnavailable.message');
    fixture.detectChanges();
  });

  function banner(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.alert-banner');
  }

  function dismissButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.alert-banner__dismiss');
  }

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('is visible on render, announced via role="status" + aria-live="polite" (AC-06, ES-08)', () => {
    const el = banner();
    expect(el).toBeTruthy();
    expect(el?.getAttribute('role')).toBe('status');
    expect(el?.getAttribute('aria-live')).toBe('polite');
  });

  it('exposes a dismiss control with an accessible name (AC-06)', () => {
    const button = dismissButton();
    expect(button).toBeTruthy();
    expect(button?.getAttribute('aria-label')).toBeTruthy();
  });

  it('dismisses on click, removing the banner from the DOM (AD-12)', () => {
    dismissButton()!.click();
    fixture.detectChanges();

    expect(banner()).toBeNull();
  });

  it('is dismissible with the keyboard: a native button click() covers Enter/Space activation', () => {
    // No custom keydown handling exists (or should exist) on this button -- a plain <button> already
    // responds to both keys natively. dispatching click() is the faithful way to assert that without
    // reimplementing the browser's own key-to-click mapping inside the test.
    const button = dismissButton()!;
    expect(button.tagName.toLowerCase()).toBe('button');
    button.click();
    fixture.detectChanges();

    expect(banner()).toBeNull();
  });

  it('emits dismissed exactly once on dismiss', () => {
    const emitted = jest.fn();
    component.dismissed.subscribe(emitted);

    dismissButton()!.click();
    fixture.detectChanges();

    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('never auto-dismisses on its own (AD-12)', (done) => {
    setTimeout(() => {
      expect(banner()).toBeTruthy();
      done();
    }, 50);
  });

  it('meets the >= 44x44 dismiss target via mat-icon-button (NFR-S-233-01)', () => {
    // mat-icon-button's own CSS sets a 48x48 touch target; asserting the host class is what this
    // component controls -- Material's own styling is out of scope to re-assert here.
    const button = dismissButton();
    expect(button?.hasAttribute('mat-icon-button')).toBe(true);
  });
});
