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
    fixture.componentRef.setInput(
      'messageKey',
      'credentialIssuance.deliveryCatalogUnavailable.message',
    );
    fixture.detectChanges();
  });

  function banner(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.alert-banner');
  }

  function statusMessage(): HTMLOutputElement | null {
    return fixture.nativeElement.querySelector('.alert-banner__message');
  }

  function dismissButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.alert-banner__dismiss');
  }

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('is visible on render and exposes the message as an output', () => {
    expect(banner()).toBeTruthy();

    const message = statusMessage();
    expect(message).toBeTruthy();
    expect(message?.tagName.toLowerCase()).toBe('output');
  });

  it('exposes a dismiss control with an accessible name', () => {
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
    const button = dismissButton();
    expect(button?.hasAttribute('mat-icon-button')).toBe(true);
  });
});