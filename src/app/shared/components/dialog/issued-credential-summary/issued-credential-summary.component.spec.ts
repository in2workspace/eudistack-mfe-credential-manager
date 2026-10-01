import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { IssuedCredentialSummaryComponent } from './issued-credential-summary.component';
import { IssuedCredentialSummary } from 'src/app/core/models/entity/lear-credential-issuance';

describe('IssuedCredentialSummaryComponent', () => {
  let fixture: ComponentFixture<IssuedCredentialSummaryComponent>;

  const machine = (extra: Partial<IssuedCredentialSummary> = {}): IssuedCredentialSummary => ({
    credentialType: 'learcredential.machine',
    typeLabel: 'LEAR Credential Machine',
    domain: 'service.eng.it',
    ipAddress: '161.162.163.164',
    ...extra
  });

  const setup = (summary?: IssuedCredentialSummary, hasKeySection = false) => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), IssuedCredentialSummaryComponent]
    });
    fixture = TestBed.createComponent(IssuedCredentialSummaryComponent);
    fixture.componentRef.setInput('summary', summary);
    fixture.componentRef.setInput('hasKeySection', hasKeySection);
    fixture.detectChanges();
  };

  const detailValues = () =>
    Array.from(fixture.nativeElement.querySelectorAll('dd')).map((d: any) => d.textContent.trim());

  const text = () => fixture.nativeElement.textContent as string;

  it('echoes back the machine identifiers the Operator typed', () => {
    setup(machine());

    expect(detailValues()).toEqual(['LEAR Credential Machine', 'service.eng.it', '161.162.163.164']);
  });

  it('omits the machine identifiers that were left blank, rather than rendering empty rows', () => {
    setup(machine({ ipAddress: undefined }));

    expect(detailValues()).toEqual(['LEAR Credential Machine', 'service.eng.it']);
  });

  it('renders no detail block for an employee credential, which has no such identifiers', () => {
    setup({ credentialType: 'learcredential.employee', typeLabel: 'LEAR Credential Employee' });

    // The type label alone is not a reason to open the block: the employee surface shows none of it.
    expect(detailValues()).toEqual([]);
  });

  it('renders no detail block for a machine whose optional identifiers were left blank', () => {
    setup(machine({ domain: undefined, ipAddress: undefined }));

    expect(detailValues()).toEqual([]);
  });

  it('picks the subtitle from the credential type', () => {
    setup(machine());

    expect(text()).toContain('result.subtitle.learcredential.machine');
  });

  /** The warning is about handing over an unrecoverable key, so it follows the key section. */
  it('warns about the key only where a key is actually handed over', () => {
    setup(machine(), false);
    expect(text()).not.toContain('result.keyWarning');

    fixture.componentRef.setInput('hasKeySection', true);
    fixture.detectChanges();

    expect(text()).toContain('result.keyWarning');
  });

  it('renders nothing at all without a summary, so a host that has none stays unchanged', () => {
    setup(undefined);

    expect(text().trim()).toBe('');
  });
});
