// dialog.component.spec.ts
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { LoaderService } from 'src/app/shared/services/loader.service';
import { DialogComponent } from './dialog.component';
import { DialogData } from '../dialog-data';

describe('DialogComponent', () => {
  let component: DialogComponent;
  let mockDialogRef: jest.Mocked<MatDialogRef<DialogComponent>>;
  let mockLoaderService: jest.Mocked<LoaderService>;

  const initialData: DialogData = {
    title: 'Test Title',
    message: 'Test Message',
    status: 'default',
    confirmationType: 'sync',
    template: {} as any,
    confirmationLabel: 'oldOk',
    cancelLabel: 'oldCancel',
  };

  beforeEach(() => {
    mockDialogRef = {
      close: jest.fn(),
      addPanelClass: jest.fn(),
      removePanelClass: jest.fn(),
    } as unknown as jest.Mocked<MatDialogRef<DialogComponent>>;

    mockLoaderService = {
      isLoading$: of(true),
    } as unknown as jest.Mocked<LoaderService>;

    TestBed.configureTestingModule({
      providers: [
        DialogComponent,
        { provide: MAT_DIALOG_DATA, useValue: initialData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: LoaderService, useValue: mockLoaderService },
      ],
    });

    component = TestBed.inject(DialogComponent);
  });

  afterEach(() => jest.resetAllMocks());

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should expose isLoading$ from LoaderService', () => {
    let loading: boolean | undefined;
    component.isLoading$.subscribe(v => (loading = v));
    expect(loading).toBe(true);
  });

  it('should call addPanelClass for default style and status in ctor', () => {
    expect(mockDialogRef.addPanelClass).toHaveBeenCalledWith('dialog-custom');
    expect(mockDialogRef.addPanelClass).toHaveBeenCalledWith('dialog-default');
  });

  describe('updateData override', () => {
    it('should reset template and labels and update status', () => {
      mockDialogRef.removePanelClass.mockClear();
      mockDialogRef.addPanelClass.mockClear();

      component.updateData({
        status: 'error',
        template: {} as any,
        confirmationLabel: 'newOk',
        cancelLabel: 'newCancel',
      });

      expect(component.data.status).toBe('error');
      // segons la implementació, es refresca i manté el nou 'template' i labels
      expect(component.data.template).toEqual({} as any);
      expect(component.data.confirmationLabel).toBe('newOk');
      expect(component.data.cancelLabel).toBe('newCancel');

      expect(mockDialogRef.removePanelClass).toHaveBeenCalledWith('dialog-default');
      expect(mockDialogRef.addPanelClass).toHaveBeenCalledWith('dialog-error');
    });
  });

  describe('getEmbeddedInstance()', () => {
    it('should return the instance if attachedRef.instance exists', () => {
      const inst = { foo: 'bar' };
      component.portalOutlet = { attachedRef: { instance: inst } } as any;
      expect(component.getEmbeddedInstance<typeof inst>()).toBe(inst);
    });

    it('should return null if attachedRef is missing', () => {
      component.portalOutlet = {} as any;
      expect(component.getEmbeddedInstance()).toBeNull();
    });

    it('should return null if attachedRef has no instance', () => {
      component.portalOutlet = { attachedRef: {} } as any;
      expect(component.getEmbeddedInstance()).toBeNull();
    });
  });

  // EUD-233 fix 2026-09-16: emphasizeCancel is opt-in on BaseDialogData and must only flip the
  // color the two action buttons render with -- never their click handler, and never the default
  // (falsy/absent) behavior every other DialogComponent consumer relies on.
  describe('confirmation button colors (emphasizeCancel, EUD-233 fix)', () => {
    let renderFixture: ComponentFixture<DialogComponent>;
    let renderDialogRef: jest.Mocked<MatDialogRef<DialogComponent>>;

    // No `template`: the non-loading branch renders a plain <p>{{ data.message }}</p> when it is
    // absent, which is all these tests need -- a real Portal is irrelevant to button colors.
    const baseRenderData: DialogData = {
      title: 'Test Title',
      message: 'Test Message',
      status: 'default',
      confirmationType: 'sync',
      confirmationLabel: 'oldOk',
      cancelLabel: 'oldCancel',
    };

    const render = (data: DialogData) => {
      renderDialogRef = {
        close: jest.fn(),
        addPanelClass: jest.fn(),
        removePanelClass: jest.fn(),
      } as unknown as jest.Mocked<MatDialogRef<DialogComponent>>;

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [DialogComponent, TranslateModule.forRoot(), NoopAnimationsModule],
        providers: [
          { provide: MAT_DIALOG_DATA, useValue: data },
          { provide: MatDialogRef, useValue: renderDialogRef },
          { provide: LoaderService, useValue: { isLoading$: of(false) } },
        ],
      });
      renderFixture = TestBed.createComponent(DialogComponent);
      renderFixture.detectChanges();
    };

    const buttonColors = (): [string | null | undefined, string | null | undefined] => {
      const buttons = renderFixture.debugElement.queryAll(By.directive(MatButton));
      // Order in the template is [cancel button, confirm button].
      return [
        buttons[0].injector.get(MatButton).color,
        buttons[1].injector.get(MatButton).color,
      ];
    };

    afterEach(() => {
      // Restore the shared module the rest of this file's tests rely on.
      TestBed.resetTestingModule();
    });

    it('defaults to cancel=grey / confirm=statusColor when emphasizeCancel is absent (today\'s behavior, unaffected)', () => {
      render({ ...baseRenderData });

      const [cancelColor, confirmColor] = buttonColors();
      expect(cancelColor).toBe('cancel');
      expect(confirmColor).toBe('primary');
    });

    it('swaps to cancel=statusColor / confirm=grey when emphasizeCancel is true', () => {
      render({ ...baseRenderData, emphasizeCancel: true });

      const [cancelColor, confirmColor] = buttonColors();
      expect(cancelColor).toBe('primary');
      expect(confirmColor).toBe('cancel');
    });

    it('still binds cancel/confirm to their original actions when swapped', () => {
      render({ ...baseRenderData, emphasizeCancel: true });
      const buttons = renderFixture.debugElement.queryAll(By.css('div[mat-dialog-actions] button'));

      buttons[0].nativeElement.click();
      expect(renderDialogRef.close).toHaveBeenCalledWith(false); // cancel, still onCancel()

      buttons[1].nativeElement.click();
      expect(renderDialogRef.close).toHaveBeenCalledWith(true); // confirm, still onConfirm()
    });
  });
});
