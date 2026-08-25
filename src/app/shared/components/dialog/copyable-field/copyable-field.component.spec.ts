import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CopyableFieldComponent } from './copyable-field.component';

describe('CopyableFieldComponent', () => {
  let fixture: ComponentFixture<CopyableFieldComponent>;
  let component: CopyableFieldComponent;
  let writeTextMock: jest.Mock;

  beforeEach(() => {
    writeTextMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    TestBed.configureTestingModule({
      imports: [CopyableFieldComponent, TranslateModule.forRoot(), NoopAnimationsModule],
    });

    fixture = TestBed.createComponent(CopyableFieldComponent);
    fixture.componentRef.setInput('labelKey', 'credentialIssuance.issuance-result-dialog.credential');
    fixture.componentRef.setInput('value', 'eyJ.token');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => jest.resetAllMocks());

  it('should render the value in a read-only input', () => {
    const input = fixture.debugElement.query(By.css('input.field-value')).nativeElement as HTMLInputElement;
    expect(input.value).toBe('eyJ.token');
    expect(input.readOnly).toBe(true);
  });

  it('should copy the value and show the confirmation, then hide it after 2s', fakeAsync(() => {
    expect(component.copied).toBe(false);

    component.copy();
    expect(writeTextMock).toHaveBeenCalledWith('eyJ.token');
    expect(component.copied).toBe(true);

    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.copied-confirmation'))).toBeTruthy();

    tick(2000);
    expect(component.copied).toBe(false);
  }));

  it('should restart the confirmation timer on a second copy instead of hiding early', fakeAsync(() => {
    component.copy();
    tick(1500);
    component.copy();

    tick(1000);
    expect(component.copied).toBe(true);

    tick(1000);
    expect(component.copied).toBe(false);
  }));

  it('should clear the pending timer on destroy', fakeAsync(() => {
    component.copy();
    fixture.destroy();
    // Without the clearTimeout in ngOnDestroy this tick would fire a callback on a dead component.
    tick(2000);
    expect(component.copied).toBe(true);
  }));
});
