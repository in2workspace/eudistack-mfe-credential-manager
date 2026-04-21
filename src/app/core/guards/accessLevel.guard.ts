import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { PoliciesService } from '../services/policies.service';


export const basicGuard: CanActivateFn = () => {
  const policiesService = inject(PoliciesService);
  return policiesService.checkOnboardingPolicy();
};


export const settingsGuard: CanActivateFn = () => {
  const policiesService = inject(PoliciesService);
  return policiesService.checkSettingsPolicy();
};
