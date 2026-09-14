import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { SessionWarningCountdownComponent } from './session-warning-countdown.component';

describe('SessionWarningCountdownComponent', () => {
  let component: SessionWarningCountdownComponent;

  beforeEach(() => {
    jest.useFakeTimers();

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [SessionWarningCountdownComponent],
    });

    component = TestBed.inject(SessionWarningCountdownComponent);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts at 120 seconds and 100%', () => {
    expect(component.remainingSeconds).toBe(120);
    expect(component.countdownPercentage).toBe(100);
  });

  it('ticks the countdown down once per second, in sync with the percentage', () => {
    component.ngOnInit();

    jest.advanceTimersByTime(1_000);
    expect(component.remainingSeconds).toBe(119);
    expect(component.countdownPercentage).toBeCloseTo((119 / 120) * 100);

    jest.advanceTimersByTime(59_000);
    expect(component.remainingSeconds).toBe(60);
    expect(component.countdownPercentage).toBeCloseTo(50);
  });

  it('stops at 0 instead of going negative', () => {
    component.ngOnInit();

    jest.advanceTimersByTime(130_000);

    expect(component.remainingSeconds).toBe(0);
    expect(component.countdownPercentage).toBe(0);
  });

  it('clears the interval on destroy so it cannot keep ticking against an unmounted component', () => {
    component.ngOnInit();
    const clearSpy = jest.spyOn(globalThis, 'clearInterval');

    component.ngOnDestroy();

    expect(clearSpy).toHaveBeenCalled();

    const secondsAfterDestroy = component.remainingSeconds;
    jest.advanceTimersByTime(5_000);
    expect(component.remainingSeconds).toBe(secondsAfterDestroy);
  });
});
