import {Component, inject} from '@angular/core';
import {ChildrenOutletContexts, NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {NavbarComponent} from '../app/shared/components/navbar/navbar.component';
import {toSignal} from '@angular/core/rxjs-interop';
import {filter, map, startWith} from 'rxjs';
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
private readonly router= inject(Router);
private readonly contexts = inject(ChildrenOutletContexts);
public readonly showNavbar$ = toSignal(this.router.events.pipe(
  filter((event): event is NavigationEnd => event instanceof NavigationEnd),
  map((event: NavigationEnd) => !event.urlAfterRedirects.startsWith('/home')),
  startWith(!this.router.url.startsWith('/home'))
));

constructor(){
  //todo remove
  console.log("AppComponent initialized");
}

public getRouteAnimationData() {
  return this.contexts.getContext('primary')?.route?.snapshot?.url;
}

}
