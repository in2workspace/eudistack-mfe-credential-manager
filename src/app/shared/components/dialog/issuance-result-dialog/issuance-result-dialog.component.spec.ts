import { TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { IssuanceResultDialogComponent, IssuanceResultDialogData } from './issuance-result-dialog.component';

describe('IssuanceResultDialogComponent', () => {
  let mockDialogRef: jest.Mocked<MatDialogRef<IssuanceResultDialogComponent>>;

  function setup(data: IssuanceResultDialogData): IssuanceResultDialogComponent {
    mockDialogRef = { close: jest.fn() } as unknown as jest.Mocked<MatDialogRef<IssuanceResultDialogComponent>>;

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), NoopAnimationsModule],
      providers: [
        IssuanceResultDialogComponent,
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    });

    return TestBed.inject(IssuanceResultDialogComponent);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    jest.resetAllMocks();
  });

  describe('box order', () => {
    it('should render direct first, then ui, then email, whatever order they were selected in', () => {
      const component = setup({ deliveryModes: ['email', 'ui', 'direct'] });
      expect(component.orderedModes).toEqual(['direct', 'ui', 'email']);
    });

    it('should only list the selected modes', () => {
      const component = setup({ deliveryModes: ['email', 'direct'] });
      expect(component.orderedModes).toEqual(['direct', 'email']);
    });

    it('should ignore anything that is not a known mode', () => {
      const component = setup({ deliveryModes: ['ui', 'carrier-pigeon' as never] });
      expect(component.orderedModes).toEqual(['ui']);
    });
  });

  describe('both-wallet-channels note', () => {
    it('should show when ui and email are both selected', () => {
      const component = setup({ deliveryModes: ['ui', 'email'] });
      expect(component.showBothWalletChannelsNote).toBe(true);
    });

    it('should not show for ui alone', () => {
      const component = setup({ deliveryModes: ['direct', 'ui'] });
      expect(component.showBothWalletChannelsNote).toBe(false);
    });

    it('should not show for email alone', () => {
      const component = setup({ deliveryModes: ['direct', 'email'] });
      expect(component.showBothWalletChannelsNote).toBe(false);
    });
  });

  it('close() should call dialogRef.close()', () => {
    const component = setup({ deliveryModes: ['direct'] });
    component.close();
    expect(mockDialogRef.close).toHaveBeenCalled();
  });

  it('should keep the token and key it was given, so the direct box can render them', () => {
    const component = setup({
      deliveryModes: ['direct'],
      credentialToken: 'eyJ.token',
      privateKey: '0xdeadbeef',
    });

    expect(component.data.credentialToken).toBe('eyJ.token');
    expect(component.data.privateKey).toBe('0xdeadbeef');
  });
});
