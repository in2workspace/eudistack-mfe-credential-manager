# Skill: Angular Frontend

Conventions and patterns for EUDIStack Angular frontend applications.

## Tech Stack

- **Angular 19+** with standalone components
- **TypeScript** strict mode
- **Testing:** Jest
- **Linting:** ESLint
- **CSS:** SCSS or Tailwind (project-dependent)
- **Build:** Angular CLI (`ng build`)

## Project Structure

```
src/
├── app/
│   ├── core/               # Singleton services, guards, interceptors
│   │   ├── services/
│   │   ├── guards/
│   │   └── interceptors/
│   ├── features/           # Feature modules (lazy-loaded)
│   │   ├── login/
│   │   ├── dashboard/
│   │   └── credentials/
│   ├── shared/             # Reusable components, pipes, directives
│   │   ├── components/
│   │   ├── pipes/
│   │   └── directives/
│   └── app.routes.ts       # Top-level routing
├── assets/
├── environments/
└── styles/
```

## Coding Patterns

### Standalone Components (Angular 17+)

```typescript
@Component({
  selector: 'app-credential-card',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  templateUrl: './credential-card.component.html',
})
export class CredentialCardComponent {
  credential = input.required<Credential>();
  revoke = output<string>();

  onRevoke(): void {
    this.revoke.emit(this.credential().id);
  }
}
```

### Signals (Angular 17+)

Prefer signals over BehaviorSubject for reactive state:

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<User | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  login(credentials: LoginRequest): Observable<User> {
    return this.http.post<User>('/api/auth/login', credentials).pipe(
      tap(user => this._user.set(user))
    );
  }
}
```

### Services

```typescript
@Injectable({ providedIn: 'root' })
export class CredentialService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(APP_CONFIG).apiUrl;

  getCredentials(): Observable<Credential[]> {
    return this.http.get<Credential[]>(`${this.baseUrl}/credentials`);
  }
}
```

### Lazy Loading Routes

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component')
      .then(m => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.routes')
      .then(m => m.DASHBOARD_ROUTES),
    canActivate: [authGuard],
  },
];
```

## Build Commands

```bash
npm ci                   # Install dependencies (CI-safe)
npm run build            # Production build
npm run build -- --configuration=development  # Dev build
ng serve                 # Dev server with live reload
npm test                 # Run tests (Jest)
npm run lint             # ESLint
```

## Test Patterns

### Component Test

```typescript
describe('CredentialCardComponent', () => {
  let component: CredentialCardComponent;
  let fixture: ComponentFixture<CredentialCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CredentialCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CredentialCardComponent);
    component = fixture.componentInstance;
    // Set required inputs
    fixture.componentRef.setInput('credential', mockCredential);
    fixture.detectChanges();
  });

  it('should display credential type', () => {
    const el = fixture.nativeElement.querySelector('.credential-type');
    expect(el.textContent).toContain('LEARCredentialEmployee');
  });
});
```

### Service Test

```typescript
describe('CredentialService', () => {
  let service: CredentialService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CredentialService],
    });
    service = TestBed.inject(CredentialService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('getCredentials should return credential list', () => {
    service.getCredentials().subscribe(credentials => {
      expect(credentials.length).toBe(2);
    });

    const req = httpMock.expectOne('/api/credentials');
    expect(req.request.method).toBe('GET');
    req.flush(mockCredentials);
  });
});
```

## Environment Configuration

```typescript
// environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',
};

// environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: '/api',
};
```

For Docker deployments, use runtime injection via `env.js`:

```html
<!-- index.html -->
<script src="assets/env.js"></script>
```

```javascript
// assets/env.js (generated at container startup)
(function(window) {
  window.__env = {
    apiUrl: '${API_URL}',
  };
})(this);
```

## Common Pitfalls

- **Never subscribe in components without cleanup:** Use `async` pipe or `takeUntilDestroyed()`.
- **Never use `any` type:** Define interfaces for all API responses.
- **Never hardcode URLs:** Use environment config or runtime injection.
- **Always use `trackBy` in `@for` loops:** Prevents unnecessary DOM re-renders.
- **Always lazy-load feature routes:** Keep initial bundle small.
