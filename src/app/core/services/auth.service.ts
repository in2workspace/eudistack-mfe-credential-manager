import { inject, Injectable, WritableSignal, signal, DestroyRef } from '@angular/core';
import { EventTypes, LoginResponse, OidcSecurityService, PublicEventsService } from 'angular-auth-oidc-client';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, take, tap } from 'rxjs/operators';
import { UserDataAuthenticationResponse } from "../models/dto/user-data-authentication-response.dto";
import { Power, EmployeeMandator } from "../models/entity/lear-credential";
import { RoleType } from '../models/enums/auth-rol-type.enum';
import { IAM_POST_LOGIN_ROUTE } from '../constants/iam.constants';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService{
  private readonly isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  private readonly userDataSubject = new BehaviorSubject<UserDataAuthenticationResponse |null>(null);
  private readonly tokenSubject = new BehaviorSubject<string>('');
  private readonly mandatorSubject = new BehaviorSubject<EmployeeMandator | null>(null);
  private readonly mandateeEmailSubject = new BehaviorSubject<string>('');
  private readonly nameSubject = new BehaviorSubject<string>('');
  public readonly roleType: WritableSignal<RoleType> = signal(RoleType.LEAR);



  private userPowers: Power[] = [];

  private readonly authEvents = inject(PublicEventsService);
  private readonly destroy$ = inject(DestroyRef);
  private readonly oidcSecurityService = inject(OidcSecurityService);
  private readonly router = inject(Router);

  public constructor() {
    this.subscribeToAuthEvents();
    this.checkAuth$().subscribe();
  }

  public subscribeToAuthEvents(): void {
    this.authEvents.registerForEvents()
      .pipe(
        takeUntilDestroyed(this.destroy$),
        filter((e) =>
          [
            EventTypes.SilentRenewStarted,
            EventTypes.SilentRenewFailed,
            EventTypes.IdTokenExpired,
            EventTypes.TokenExpired
          ].includes(e.type)
        )
      )
      .subscribe((event) => {
        const isOffline = !navigator.onLine;

        switch (event.type) {
          case EventTypes.SilentRenewStarted:
            break;

          // before this happens, the library cleans up the local auth data
          case EventTypes.SilentRenewFailed:

            if (isOffline) {
              console.error('Silent token refresh failed: offline mode', event);

              const onlineHandler = () => {
                this.checkAuth$().subscribe(
                  {
                    next: ({ isAuthenticated }) => {
                      if (isAuthenticated) {
                        // reauthenticated successfully after reconnect
                      } else {
                        console.error('User still not authenticated after reconnect, logging out');
                        this.authorize();
                      }
                    },
                    error: (err) => {
                      console.error('Error while reauthenticating after reconnect:', err);
                      this.authorize();
                    },
                    complete: () => {
                      globalThis.removeEventListener('online', onlineHandler);
                    }
                  });

              };

              globalThis.addEventListener('online', onlineHandler);

            } else {
              console.error('Silent token refresh failed: online mode, proceeding to logout', event);
              this.authorize();
            }
            break;

          case EventTypes.IdTokenExpired:
          case EventTypes.TokenExpired:
            console.error('Session expired at: ' + Date.now(), event);
            break;
        }
      });
  }

  public checkAuth$(): Observable<LoginResponse> {
    return this.oidcSecurityService.checkAuth().pipe(
      take(1),
      tap(({ isAuthenticated, userData}) => {
      this.isAuthenticatedSubject.next(isAuthenticated);

      if (isAuthenticated) {
        const role = this.resolveRole(userData);
        if(role != null && role !== RoleType.LEAR)  throw new Error('Error Role. '+ role);
        this.userDataSubject.next(userData);
        this.handleUserAuthentication(userData);

        if (this.router.url === '/') {
          this.router.navigate([IAM_POST_LOGIN_ROUTE]);
        }
      }else{
          console.error('Checking authentication: not authenticated.');
      }
    }),
    catchError((err:Error)=>{
      console.error('Checking authentication: error in initial authentication.');
      return throwError(()=>err);
    }));
  }


  public logout(): void {
    this.oidcSecurityService.logoffLocal();
    this.isAuthenticatedSubject.next(false);
    this.userDataSubject.next(null);
    this.tokenSubject.next('');
    this.mandatorSubject.next(null);
    this.mandateeEmailSubject.next('');
    this.nameSubject.next('');
    this.userPowers = [];
    sessionStorage.clear();
    this.router.navigate(['/']);
  }

  public authorize(){
    this.oidcSecurityService.authorize();
  }

  private resolveRole(userData: UserDataAuthenticationResponse): RoleType | null {
    return userData.role ?? null;
  }

  private handleUserAuthentication(userData: UserDataAuthenticationResponse): void {
    try {
      // Unwrap mandate wrapper if present (SD-JWT with nested disclosures)
      this.unwrapMandate(userData);

      if (userData.mandator && userData.mandatee) {
        this.handleFlatClaimsLogin(userData);
      } else {
        console.error('Missing mandatee or mandator claims in ID Token.');
      }
    } catch (error) {
      console.error(error);
    }
  }

  private unwrapMandate(userData: any): void {
    if (userData.mandate && typeof userData.mandate === 'object') {
      if (!userData.mandatee && userData.mandate.mandatee) {
        userData.mandatee = userData.mandate.mandatee;
      }
      if (!userData.mandator && userData.mandate.mandator) {
        userData.mandator = userData.mandate.mandator;
      }
      if (!userData.power && userData.mandate.power) {
        userData.power = userData.mandate.power;
      }
    }
  }

  // Future work: certificate-based login
  private handleCertificateLogin(userData: UserDataAuthenticationResponse): void {
    const certData = this.extractDataFromCertificate(userData);
    this.mandatorSubject.next(certData);
    this.nameSubject.next(certData.commonName);
  }

  private extractDataFromCertificate(userData: UserDataAuthenticationResponse): EmployeeMandator {
    return {
        id: userData.id,
        organizationIdentifier: userData.organizationIdentifier,
        organization: userData.organization,
        commonName: userData.name,
        email: userData?.email ?? '',
        serialNumber: userData?.serial_number ?? '',
        country: userData.country
      }
  }

  private handleFlatClaimsLogin(userData: UserDataAuthenticationResponse): void {
    const mandator: EmployeeMandator = {
      id: userData.mandator!.id,
      organizationIdentifier: userData.mandator!.organizationIdentifier,
      organization: userData.mandator!.organization,
      commonName: userData.mandator!.commonName,
      email: userData.mandator!.email,
      serialNumber: userData.mandator!.serialNumber,
      country: userData.mandator!.country
    };
    this.mandatorSubject.next(mandator);

    const email = userData.mandatee!.email ?? '';
    const name = (userData.mandatee!.firstName ?? '') + ' ' + (userData.mandatee!.lastName ?? '');
    this.mandateeEmailSubject.next(email);
    this.nameSubject.next(name.trim());
    this.userPowers = this.extractPowersFromClaims(userData);
  }

  public hasPower(tmfFunction: string, tmfAction: string): boolean {
    return this.userPowers.some((power: Power) => {
      if (power.function === tmfFunction) {
        const action = power.action;
        return action === tmfAction || (Array.isArray(action) && action.includes(tmfAction));
      }
      return false;
    });
  }

  // POLICY: user_powers_restriction_policy
  public hasAdminOrganizationIdentifier() : boolean {
    const mandatorData = this.mandatorSubject.getValue();
    if (mandatorData != null){
      return environment.admin_organization_id === mandatorData.organizationIdentifier;
    }
    return false
  }

  public getMandator(): Observable<EmployeeMandator | null> {
    return this.mandatorSubject.asObservable();
  }

  //todo maybe rename (i.e. getPlainMandator), since "Raw" is being used for unnormalized VC/fields
  public extractRawMandator(): EmployeeMandator | null {
    return this.mandatorSubject.getValue();
  }

  public login(): void {
    this.oidcSecurityService.authorize();
  }

  public handleLoginCallback(): void {
    this.oidcSecurityService.checkAuth()
      .pipe(take(1))
      .subscribe(({ isAuthenticated, userData, accessToken }) => {
        if (isAuthenticated) {
          this.userPowers = this.extractPowersFromClaims(userData);
          const hasOnboardingPower = this.hasPower('Onboarding', 'Execute');
          if (!hasOnboardingPower) {
            this.logout();
            return;
          }

          this.isAuthenticatedSubject.next(true);
          this.userDataSubject.next(userData);
          this.tokenSubject.next(accessToken);
        }
      });
  }

  public isLoggedIn(): Observable<boolean> {
    return this.isAuthenticated$;
  }

  public getUserData(): Observable<UserDataAuthenticationResponse | null> {
    return this.userDataSubject.asObservable();
  }

  public getMandateeEmail(): string {
    return this.mandateeEmailSubject.getValue();
  }

  public getToken(): Observable<string> {
    return this.tokenSubject.asObservable();
  }

  public getName(): Observable<string> {
    return this.nameSubject.asObservable()
  }

  private extractPowersFromClaims(userData: UserDataAuthenticationResponse): Power[] {
    try {
      return (userData.power as Power[]) ?? [];
    } catch {
      return [];
    }
  }

}
