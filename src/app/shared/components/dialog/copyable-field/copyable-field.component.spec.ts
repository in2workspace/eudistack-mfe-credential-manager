import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { CopyableFieldComponent } from './copyable-field.component';
import { ClipboardService } from '../../../services/clipboard.service';

describe('CopyableFieldComponent', () => {
  let fixture: ComponentFixture<CopyableFieldComponent>;
  let component: CopyableFieldComponent;
  let clipboardService: {
    copy: jest.Mock<Promise<void>, [string, number?]>;
  };

  function setup(
    copyImpl: (text: string, ttlMs?: number) => Promise<void> =
      () => Promise.resolve(),
  ) {
    clipboardService = {
      copy: jest.fn(copyImpl),
    };

    TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot(),
        CopyableFieldComponent,
      ],
      providers: [
        {
          provide: ClipboardService,
          useValue: clipboardService,
        },
      ],
    });

    fixture = TestBed.createComponent(CopyableFieldComponent);
    fixture.componentRef.setInput(
      'labelKey',
      'credentialIssuance.holderPrivateKey.label',
    );
    fixture.componentRef.setInput('value', 'secret-value');

    component = fixture.componentInstance;

    fixture.detectChanges();
  }

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should create the component', () => {
    setup();

    expect(component).toBeTruthy();
  });

  describe('copy() success', () => {
    beforeEach(() => {
      setup();
    });

    it('copies the value through ClipboardService', async () => {
      await component.copy();

      expect(clipboardService.copy).toHaveBeenCalledWith(
        'secret-value',
        undefined,
      );
    });

    it('emits copied exactly once (AD-16 gating signal)', async () => {
      const emitted = jest.fn();
      component.copied.subscribe(emitted);

      await component.copy();

      expect(emitted).toHaveBeenCalledTimes(1);
    });

    it('shows the "Copied!" label in the copy button and never reverts it back to "Copy"', async () => {
      await component.copy();
      fixture.detectChanges();

      const button: HTMLButtonElement =
        fixture.nativeElement.querySelector('.copy-button');

      expect(button.textContent).toContain(
        'credentialIssuance.credential-offer-dialog.copied',
      );
    });

    it('keeps the copy button clickable and re-copies on every further click', async () => {
      await component.copy();
      await component.copy();

      expect(clipboardService.copy).toHaveBeenCalledTimes(2);
      expect(clipboardService.copy).toHaveBeenNthCalledWith(
        1,
        'secret-value',
        undefined,
      );
      expect(clipboardService.copy).toHaveBeenNthCalledWith(
        2,
        'secret-value',
        undefined,
      );
    });

    it('emits copied on every successful copy', async () => {
      const copied = jest.fn();
      component.copied.subscribe(copied);

      await component.copy();
      await component.copy();

      expect(copied).toHaveBeenCalledTimes(2);
    });

    it('never emits copyFailed on a successful copy', async () => {
      const failed = jest.fn();
      component.copyFailed.subscribe(failed);

      await component.copy();

      expect(failed).not.toHaveBeenCalled();
    });

    it('passes the configured clipboard TTL to ClipboardService', async () => {
      fixture.componentRef.setInput('clipboardTtlMs', 60_000);
      fixture.detectChanges();

      await component.copy();

      expect(clipboardService.copy).toHaveBeenCalledWith(
        'secret-value',
        60_000,
      );
    });
  });

  describe('copy() failure (ES-05, ES-07.1, ES-07.2)', () => {
    beforeEach(() => {
      setup(() => Promise.reject(new Error('denied')));
    });

    it('emits copyFailed instead of copied', async () => {
      const copied = jest.fn();
      const failed = jest.fn();

      component.copied.subscribe(copied);
      component.copyFailed.subscribe(failed);

      await component.copy();

      expect(failed).toHaveBeenCalledTimes(1);
      expect(copied).not.toHaveBeenCalled();
    });

    it('never shows the "Copied!" label on the copy button', async () => {
      await component.copy();
      fixture.detectChanges();

      const button: HTMLButtonElement =
        fixture.nativeElement.querySelector('.copy-button');

      expect(button.textContent).toContain('dialog.copy');
      expect(button.textContent).not.toContain(
        'credentialIssuance.credential-offer-dialog.copied',
      );
    });

    it('does not emit copied after a failed copy', async () => {
      const copied = jest.fn();
      component.copied.subscribe(copied);

      await component.copy();

      expect(copied).not.toHaveBeenCalled();
    });
  });

describe('visibility toggle', () => {
  beforeEach(() => {
    setup();
  });

  it('renders the value masked by default', () => {
    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input[matInput]');

    expect(input).not.toBeNull();
    expect(input.type).toBe('password');
    expect(input.value).toBe('secret-value');
  });

  it('reveals the value as plain text when toggled, and re-masks on a second toggle', () => {
    const toggle: HTMLButtonElement =
      fixture.nativeElement.querySelector('.field-input button');
    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('input[matInput]');

    expect(toggle).not.toBeNull();
    expect(input).not.toBeNull();

    toggle.click();
    fixture.detectChanges();

    expect(input.type).toBe('text');

    toggle.click();
    fixture.detectChanges();

    expect(input.type).toBe('password');
  });

  it('does not affect what copy() sends to ClipboardService while masked', async () => {
    await component.copy();

    expect(clipboardService.copy).toHaveBeenCalledWith(
      'secret-value',
      undefined,
    );
  });

  it('does not affect what copy() sends to ClipboardService while revealed', async () => {
    const toggle: HTMLButtonElement =
      fixture.nativeElement.querySelector('.field-input button');

    toggle.click();
    fixture.detectChanges();

    await component.copy();

    expect(clipboardService.copy).toHaveBeenCalledWith(
      'secret-value',
      undefined,
    );
  });
});

  describe('copiedLabelKey', () => {
    it('uses the configured copied label key', async () => {
      setup();

      fixture.componentRef.setInput('copiedLabelKey', 'custom.copied');
      fixture.detectChanges();

      await component.copy();
      fixture.detectChanges();

      const button: HTMLButtonElement =
        fixture.nativeElement.querySelector('.copy-button');

      expect(button.textContent).toContain('custom.copied');
    });
  });
});
