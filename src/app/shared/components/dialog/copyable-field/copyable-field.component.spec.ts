import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { CopyableFieldComponent } from './copyable-field.component';

describe('CopyableFieldComponent', () => {
  let fixture: ComponentFixture<CopyableFieldComponent>;
  let component: CopyableFieldComponent;
  let writeTextMock: jest.Mock;

  function setClipboard(impl: (text: string) => Promise<void>) {
    writeTextMock = jest.fn(impl);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
  }

  function setup() {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), CopyableFieldComponent],
    });
    fixture = TestBed.createComponent(CopyableFieldComponent);
    fixture.componentRef.setInput('labelKey', 'credentialIssuance.holderPrivateKey.label');
    fixture.componentRef.setInput('value', 'secret-value');
    component = fixture.componentInstance;
  }

  afterEach(() => jest.restoreAllMocks());

  it('should create the component', () => {
    setClipboard(() => Promise.resolve());
    setup();
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('copy() success', () => {
    beforeEach(() => {
      setClipboard(() => Promise.resolve());
      setup();
      fixture.detectChanges();
    });

    it('writes the value to the clipboard', async () => {
      await component.copy();
      expect(writeTextMock).toHaveBeenCalledWith('secret-value');
    });

    it('emits copied exactly once (AD-16 gating signal)', async () => {
      const emitted = jest.fn();
      component.copied.subscribe(emitted);

      await component.copy();

      expect(emitted).toHaveBeenCalledTimes(1);
    });

    it('shows the "Copied!" confirmation and resets it after 2s, independent of any TTL', async () => {
      jest.useFakeTimers();
      await component.copy();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.copied-confirmation')).toBeTruthy();

      jest.advanceTimersByTime(2000);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.copied-confirmation')).toBeNull();
      jest.useRealTimers();
    });

    it('never emits copyFailed on a successful copy', async () => {
      const failed = jest.fn();
      component.copyFailed.subscribe(failed);

      await component.copy();

      expect(failed).not.toHaveBeenCalled();
    });
  });

  describe('copy() failure (ES-05, ES-07.1, ES-07.2)', () => {
    beforeEach(() => {
      setClipboard(() => Promise.reject(new Error('denied')));
      setup();
      fixture.detectChanges();
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

    it('never shows the "Copied!" confirmation', async () => {
      await component.copy();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.copied-confirmation')).toBeNull();
    });
  });

  describe('clipboardTtlMs (AD-10, R-4)', () => {
    it('overwrites the clipboard after the given TTL, restarted (not stacked) on every copy', async () => {
      setClipboard(() => Promise.resolve());
      setup();
      fixture.componentRef.setInput('clipboardTtlMs', 60_000);
      fixture.detectChanges();
      jest.useFakeTimers();

      await component.copy();
      jest.advanceTimersByTime(30_000);
      await component.copy(); // restarts the timer -- must not double-clear at the old deadline
      jest.advanceTimersByTime(30_000);
      expect(writeTextMock).not.toHaveBeenCalledWith('');

      jest.advanceTimersByTime(30_000);
      expect(writeTextMock).toHaveBeenCalledWith('');
      expect(writeTextMock).toHaveBeenCalledTimes(3); // 2 real copies + 1 clear

      jest.useRealTimers();
    });

    it('never schedules a clipboard-clear when the TTL is omitted', async () => {
      setClipboard(() => Promise.resolve());
      setup();
      fixture.detectChanges();
      jest.useFakeTimers();

      await component.copy();
      jest.advanceTimersByTime(120_000);

      expect(writeTextMock).not.toHaveBeenCalledWith('');
      expect(writeTextMock).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  describe('ngOnDestroy', () => {
    it('performs the pending clipboard clear immediately rather than merely cancelling it', async () => {
      setClipboard(() => Promise.resolve());
      setup();
      fixture.componentRef.setInput('clipboardTtlMs', 60_000);
      fixture.detectChanges();

      await component.copy();
      fixture.destroy();

      expect(writeTextMock).toHaveBeenCalledWith('');
    });
  });
});
