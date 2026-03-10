import { LEARCredential, EmployeeMandatee, Power, VerifiableCertification, Attester, EmployeeMandator } from './../../../core/models/entity/lear-credential';

// Interfaces for the raw JSON of Mandatee and Power
interface RawEmployeeMandatee {
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  email?: string;
  emailAddress?: string
}

interface RawEmployeeMandator {
  email?: string;
  emailAddress?: string
}

interface RawPower {
  action?: string | string[];
  tmf_action?: string | string[];
  domain?: string;
  tmf_domain?: string;
  function?: string;
  tmf_function?: string;
  type?: string;
  tmf_type?: string;
}

interface RawVerifiableCertification extends VerifiableCertification{
  atester?: Attester;
}

export class LEARCredentialDataNormalizer {

  public normalizeLearCredential(data: LEARCredential): LEARCredential {
    const normalized: any = { ...data };
    if (normalized.credentialSubject && typeof normalized.credentialSubject === 'object') {
      normalized.credentialSubject = { ...normalized.credentialSubject };
    }

    const types = Array.isArray(normalized?.type) ? normalized.type : [];
    const vct = typeof normalized?.vct === 'string' ? normalized.vct : '';
    const isEmployee = types.some((t: string) => t.startsWith('learcredential.employee.')) || vct.startsWith('learcredential.employee.');
    const isMachine  = types.some((t: string) => t.startsWith('learcredential.machine.')) || vct.startsWith('learcredential.machine.');
    const isVerCert  = types.includes('VerifiableCertification');

    this.normalizeStatusIfNeeded(normalized);
    this.normalizeMandateIfNeeded(normalized, isEmployee, isMachine);
    this.normalizeCertificationIfNeeded(normalized, isVerCert);

    return normalized;
  }

  private normalizeMandateIfNeeded(
    data: any,
    isEmployee: boolean,
    isMachine: boolean
  ) {
    if (!(isEmployee || isMachine)) return;

    // SD-JWT "direct" strategy: mandator/mandatee/power live at the credential
    // root instead of under credentialSubject. Wrap them so downstream code
    // (schemas, detail views) can use the uniform W3C path.
    this.wrapTopLevelFlatStructure(data);

    const sub = data.credentialSubject;
    if (!sub) return;

    this.wrapFlatMandateStructure(sub);
    if (!sub.mandate) return;

    sub.mandate = { ...sub.mandate };
    if (isEmployee && sub.mandate.mandatee) {
      sub.mandate.mandatee = this.normalizeEmployeeMandatee(sub.mandate.mandatee);
    }
    if(isEmployee && sub.mandate.mandator){
      sub.mandate.mandator = this.normalizeEmployeeMandator(sub.mandate.mandator);
    }
    if (Array.isArray(sub.mandate.power)) {
      sub.mandate.power = sub.mandate.power.map((p: RawPower) => this.normalizePower(p));
    }
  }

  /**
   * SD-JWT credentials with "direct" credential_subject_strategy place
   * mandator/mandatee/power at the credential root (no credentialSubject).
   * This creates the credentialSubject.mandate wrapper so downstream code
   * can use the uniform W3C path.
   */
  private wrapTopLevelFlatStructure(data: any): void {
    if (data.credentialSubject || !('mandator' in data || 'mandatee' in data || 'power' in data)) return;
    data.credentialSubject = {
      mandate: {
        ...(data.mandator ? { mandator: data.mandator } : {}),
        ...(data.mandatee ? { mandatee: data.mandatee } : {}),
        ...(data.power ? { power: data.power } : {}),
      }
    };
    delete data.mandator;
    delete data.mandatee;
    delete data.power;
  }

  /**
   * SD-JWT credentials place mandator/mandatee/power directly on credentialSubject
   * instead of nesting them under a `mandate` object (W3C format).
   * This wraps the flat structure so downstream code works uniformly.
   */
  private wrapFlatMandateStructure(sub: any): void {
    if ('mandate' in sub || !('mandator' in sub || 'mandatee' in sub || 'power' in sub)) return;
    sub.mandate = {
      ...(sub.mandator ? { mandator: sub.mandator } : {}),
      ...(sub.mandatee ? { mandatee: sub.mandatee } : {}),
      ...(sub.power ? { power: sub.power } : {}),
    };
    delete sub.mandator;
    delete sub.mandatee;
    delete sub.power;
  }

  /**
   * SD-JWT credentials use `status.status_list` (Token Status List) instead of
   * the W3C `credentialStatus` envelope. This maps the Token Status List structure
   * to the unified CredentialStatus interface so downstream code works uniformly.
   */
  private normalizeStatusIfNeeded(data: any): void {
    if (data.credentialStatus) return;
    const sl = data.status?.status_list;
    if (!sl?.uri) return;
    data.credentialStatus = {
      id: `${sl.uri}#${sl.idx}`,
      type: 'TokenStatusListEntry',
      statusPurpose: 'revocation',
      statusListIndex: String(sl.idx),
      statusListCredential: sl.uri,
    };
  }

  private normalizeCertificationIfNeeded(
    data: any,
    isVerCert: boolean
  ) {
    if (!isVerCert || !('atester' in data)) return;
    const raw = data as RawVerifiableCertification;
    if (!raw.atester) return;
    raw.attester = raw.atester;
    delete raw.atester;
  }

private normalizeEmployeeMandatee(data: RawEmployeeMandatee): EmployeeMandatee {

  const firstName = data.firstName ?? data.first_name ?? "";
  const lastName  = data.lastName ?? data.last_name ?? "";
  const email = data.email ?? data.emailAddress ?? "";

  const copy = { ...data, firstName, lastName, email };
  delete copy.first_name;
  delete copy.last_name;
  delete copy.emailAddress;

  return copy;
}

private normalizeEmployeeMandator(mandator: RawEmployeeMandator): EmployeeMandator {
  const copy: RawEmployeeMandator = { ...mandator };
  copy.email = mandator.email ?? mandator.emailAddress ?? "";
  delete copy.emailAddress;
  return copy as EmployeeMandator;
}


private normalizePower(data: RawPower): Power {
  const action = data.action   ?? data.tmf_action ?? '';
  const domain = data.domain   ?? data.tmf_domain ?? '';
  const func   = data.function ?? data.tmf_function ?? '';
  const type   = data.type     ?? data.tmf_type ?? '';

  if (!action) {
    console.error('Missing power action. Using default: ""');
  }
  if (!domain) {
    console.error('Missing power domain. Using default:  ""');
  }
  if (!func) {
    console.error('Missing power function. Using default:  ""');
  }
  if (!type) {
    console.error('Missing power type. Using default:  ""');
  }

  return {
    action,
    domain,
    function: func,
    type
  };
}

}
