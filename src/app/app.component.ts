import {Component, inject} from '@angular/core';
import {ChildrenOutletContexts, RouterOutlet} from '@angular/router';
import {NavbarComponent} from '../app/shared/components/navbar/navbar.component';
import {trigger, transition, style, animate, query} from '@angular/animations';

export const routeAnimations = trigger('routeAnimations', [
  transition('* <=> *', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(8px)' }),
      animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
    ], { optional: true })
  ])
]);

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    imports: [RouterOutlet, NavbarComponent],
    animations: [routeAnimations]
})
export class AppComponent {
  public title = 'Credential-issuer-ui';
  private readonly contexts = inject(ChildrenOutletContexts);

  public getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.url;
  }
}
