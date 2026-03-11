export interface MandateeIdTokenClaim {
  id?: string;
  employeeId?: string;
  email: string;
  firstName: string;
  lastName: string;
  mobile_phone?: string;
  // machine fields
  domain?: string;
  ipAddress?: string;
}

export interface MandatorIdTokenClaim {
  id: string;
  commonName: string;
  country: string;
  organization: string;
  organizationIdentifier: string;
  serialNumber: string;
  email: string;
}

export interface PowerIdTokenClaim {
  id?: string;
  action: string[] | string;
  domain: string;
  function: string;
  type: string;
}

export interface UserDataAuthenticationResponse {
  id: string;
  sub: string;
  commonName: string;
  country: string;
  serialNumber: string;
  email_verified: boolean;
  preferred_username: string;
  given_name: string;
  "tenant-id": string;
  emailAddress: string;
  organizationIdentifier: string;
  organization: string;
  name: string;
  family_name: string;
  serial_number?: string;
  email?: string;
  credential_type?: string;
  mandatee?: MandateeIdTokenClaim;
  mandator?: MandatorIdTokenClaim;
  power?: PowerIdTokenClaim[];
  role?: import('../enums/auth-rol-type.enum').RoleType;
  vc_json?: string;
}
