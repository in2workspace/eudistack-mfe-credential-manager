import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';

import { DetailsPowerComponent, detailsPowerToken } from './details-power.component';
import { Power } from 'src/app/core/models/entity/lear-credential';

describe('DetailsPowerComponent', () => {
  let component: DetailsPowerComponent;
  let fixture: ComponentFixture<DetailsPowerComponent>;

  const mockPowers: Power[] = [
    { domain: 'tenant-a', function: 'firstFunction', action: ['read', 'write'], type: 't1' },
    { domain: 'tenant-a', function: 'secondFunction', action: ['execute'], type: 't1' },
    { domain: 'tenant-a', function: 'thirdFunction', action: ['delete', 'update', 'create'], type: 't1' }
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

  it('should inject the real domain correctly', () => {
    expect(component.domain).toBe('tenant-a');
  });

});
