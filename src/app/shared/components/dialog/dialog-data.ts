import { ComponentPortal, TemplatePortal, DomPortal } from "@angular/cdk/portal";

export type DialogStatus = 'default' | 'error';
export type DialogConfirmationType = 'none' | 'sync' | 'async';
export interface LoadingData { title:string, message:string; template?:ComponentPortal<any> | TemplatePortal | DomPortal }
export interface DialogDefaultContent {
  data: DialogData;
}
export interface BaseDialogData{
  title: string;
  message: string;
  status: DialogStatus;
  confirmationType: DialogConfirmationType;
  loadingData?: LoadingData;
  confirmationLabel?: string;
  cancelLabel?: string;
  style?: string;
  /**
   * Opt-in only (falsy/absent behaves exactly as before). When true, swaps which button gets the
   * primary `statusColor` treatment: cancel becomes the emphasized one, confirm falls back to the
   * plain "cancel" (grey/secondary) color -- click handlers (onCancel()/onConfirm()) are unchanged,
   * only the visual weight moves. Used by destructive-by-default confirmations (EUD-233 fix
   * 2026-09-16) where "stay here" should read as the safer, encouraged choice.
   */
  emphasizeCancel?: boolean;
}

export interface DialogData extends BaseDialogData{
  template?: ComponentPortal<any> | TemplatePortal | DomPortal;
}
