import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';

import { DetailsPowerComponent, detailsPowerToken } from './details-power.component';
import { FunctionActions } from '../../helpers/credential-details-helpers';
import { ThemeService } from 'src/app/core/services/theme.service';

describe('DetailsPowerComponent', () => {
  let component: DetailsPowerComponent;
  let fixture: ComponentFixture<DetailsPowerComponent>;

  const mockPowers: FunctionActions[] = [
    { function: 'firstFunction', actions: ['read', 'write'] },
    { function: 'secondFunction', actions: ['execute'] },
    { function: 'thirdFunction', actions: ['delete', 'update', 'create'] }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DetailsPowerComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot()
      ],
      providers: [
        { provide: detailsPowerToken, useValue: mockPowers },
        { provide: ThemeService, useValue: { tenantDomain: 'TENANT' } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DetailsPowerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should inject the powers array correctly', () => {
    expect(component.powers).toBe(mockPowers);
  });

});
