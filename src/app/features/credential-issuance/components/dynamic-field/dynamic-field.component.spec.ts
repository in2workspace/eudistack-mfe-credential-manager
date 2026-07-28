import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { ComponentRef } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DynamicFieldComponent } from './dynamic-field.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { BUILTIN_VALIDATORS_FACTORY_MAP } from 'src/app/shared/validators/credential-issuance/wrapped-built-in-validators';
import { CUSTOM_VALIDATORS_FACTORY_MAP } from 'src/app/shared/validators/credential-issuance/custom-validators';

const mockControl = new FormControl('value');
const mockGroup = new FormGroup({ prop: mockControl });
const mockControlSchema = { type: 'control' } as any;
const mockGroupSchema = { type: 'group', fields: [{ key: 'fieldOne' }] } as any;

describe('DynamicFieldComponent', () => {
  let component: DynamicFieldComponent;
  let fixture: ComponentFixture<DynamicFieldComponent>;
  let componentRef: ComponentRef<DynamicFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DynamicFieldComponent,
        ReactiveFormsModule,
        TranslateModule.forRoot(),
        NoopAnimationsModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DynamicFieldComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;

    componentRef.setInput('parentFormGroup$', mockGroup);
    componentRef.setInput('fieldName$', 'prop');
    componentRef.setInput('fieldPath$', 'mandator.prop');
    componentRef.setInput('fieldSchema$', mockControlSchema);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('computed properties', () => {
    it('controlId$() should use the full field path when provided', () => {
      expect(component.controlId$()).toBe('mandator.prop');
    });

    it('errorId$() should derive from controlId$() with an "-error" suffix', () => {
      expect(component.errorId$()).toBe('mandator.prop-error');
    });

    it('parentFormGroup$() should return the FormGroup passed via parentFormGroup$', () => {
      expect(component.parentFormGroup$()).toBe(mockGroup);
    });

    it('controlSchema$() should return null if the type is group', () => {
      componentRef.setInput('fieldSchema$', mockGroupSchema);
      expect(component.controlSchema$()).toBeNull();
    });

    it('controlSchema$() should return the schema when the type is control', () => {
      expect(component.controlSchema$()).toBe(mockControlSchema);
    });

    it('groupSchema$() should return null if the type is control', () => {
      expect(component.groupSchema$()).toBeNull();
    });

    it('groupSchema$() should return the schema when the type is group', () => {
      componentRef.setInput('fieldSchema$', mockGroupSchema);
      expect(component.groupSchema$()).toBe(mockGroupSchema);
    });

    it('childControl$() should return the FormControl when type is control', () => {
      expect(component.childControl$()).toBe(mockControl);
    });

    it('childControl$() should throw if the parent group is null', () => {
      componentRef.setInput('parentFormGroup$', null);
      expect(() => component.childControl$()).toThrow();
    });

    it('childGroup$() should return null when type is control', () => {
      expect(component.childGroup$()).toBeNull();
    });

    it('childGroup$() should return the FormGroup when the field is a nested FormGroup', () => {
      const nestedGroup = new FormGroup({ inner: new FormControl('') });
      const wrapper = new FormGroup({ prop: nestedGroup });
      componentRef.setInput('parentFormGroup$', wrapper);
      componentRef.setInput('fieldSchema$', mockGroupSchema);
      expect(component.childGroup$()).toBe(nestedGroup);
    });

    it('childGroup$() should return null if the field is not a FormGroup', () => {
      componentRef.setInput('fieldSchema$', mockGroupSchema);
      expect(component.childGroup$()).toBeNull();
    });
  });

  describe('getErrorMessage', () => {
    it('should return empty string if control is null', () => {
      expect(component.getErrorMessage(null)).toBe('');
    });

    it('should return empty string if control has no errors', () => {
      const ctrl = new FormControl();
      expect(component.getErrorMessage(ctrl)).toBe('');
    });

    it('should return the value property of the first error', () => {
      const ctrl = new FormControl();
      ctrl.setErrors({ customError: { value: 'Error occurred', args: [] } });
      expect(component.getErrorMessage(ctrl)).toBe('Error occurred');
    });
  });

  describe('getErrorsArgs', () => {
    it('should return empty object if control is null', () => {
      expect(component.getErrorsArgs(null)).toEqual({});
    });

    it('should return empty object if control has no errors', () => {
      const ctrl = new FormControl();
      expect(component.getErrorsArgs(ctrl)).toEqual({});
    });

    it('should return empty object if error has no args', () => {
      const ctrl = new FormControl();
      ctrl.setErrors({ err: { value: 'Error', args: [] } });
      expect(component.getErrorsArgs(ctrl)).toEqual({});
    });

    it('should map args array to numeric keys in the returned object', () => {
      const ctrl = new FormControl();
      ctrl.setErrors({ err: { value: 'Error', args: ['first', 'second'] } });
      expect(component.getErrorsArgs(ctrl)).toEqual({ '0': 'first', '1': 'second' });
    });
  });

  function controlField(over: Record<string, any> = {}): any {
    return {
      key: 'firstName',
      type: 'control',
      controlType: 'text',
      display: 'main',
      validators: [{ name: 'required' }],
      ...over,
    };
  }

  describe('EUD-73 — validation feedback', () => {
    it('AC-02: muestra mat-error de required en obligatorio vacío + touched', () => {
      const ctrl = new FormControl('', { validators: [BUILTIN_VALIDATORS_FACTORY_MAP.required()] });
      const group = new FormGroup({ firstName: ctrl });
      componentRef.setInput('parentFormGroup$', group);
      componentRef.setInput('fieldName$', 'firstName');
      componentRef.setInput('fieldPath$', 'firstName');
      componentRef.setInput('fieldSchema$', controlField());
      ctrl.markAsTouched();
      fixture.detectChanges();

      const err = fixture.debugElement.query(By.css('mat-error'));
      expect(err).toBeTruthy();
      expect(err.nativeElement.textContent).toContain('error.form.required');
    });

    it('AC-01: formulario válido no pinta ningún mat-error', () => {
      const ctrl = new FormControl('Alice', { validators: [BUILTIN_VALIDATORS_FACTORY_MAP.required()] });
      const group = new FormGroup({ firstName: ctrl });
      componentRef.setInput('parentFormGroup$', group);
      componentRef.setInput('fieldName$', 'firstName');
      componentRef.setInput('fieldPath$', 'firstName');
      componentRef.setInput('fieldSchema$', controlField());
      ctrl.markAsTouched();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('mat-error'))).toBeFalsy();
    });

    it('AC-03 / ES-01: renderiza controlType date como input[type=date] y muestra mat-error de formato', () => {
      const ctrl = new FormControl('2026-13-31', { validators: [CUSTOM_VALIDATORS_FACTORY_MAP.date()] });
      const group = new FormGroup({ birthDate: ctrl });
      componentRef.setInput('parentFormGroup$', group);
      componentRef.setInput('fieldName$', 'birthDate');
      componentRef.setInput('fieldPath$', 'birthDate');
      componentRef.setInput('fieldSchema$', controlField({ key: 'birthDate', controlType: 'date', validators: [{ name: 'date' }] }));
      ctrl.markAsTouched();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input')).nativeElement;
      expect(input.getAttribute('type')).toBe('date');
      const err = fixture.debugElement.query(By.css('mat-error'));
      expect(err).toBeTruthy();
      expect(err.nativeElement.textContent).toContain('error.form.date');
    });

    it('NFR-A-EUD73-01: aria-invalid y aria-describedby en input inválido, vinculados al mat-error', () => {
      const ctrl = new FormControl('', { validators: [BUILTIN_VALIDATORS_FACTORY_MAP.required()] });
      const group = new FormGroup({ firstName: ctrl });
      componentRef.setInput('parentFormGroup$', group);
      componentRef.setInput('fieldName$', 'firstName');
      componentRef.setInput('fieldPath$', 'mandatee.firstName');
      componentRef.setInput('fieldSchema$', controlField());
      ctrl.markAsTouched();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input')).nativeElement;
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe('mandatee.firstName-error');

      const errorEl = fixture.debugElement.query(By.css('mat-error')).nativeElement;
      expect(errorEl.getAttribute('id')).toBe('mandatee.firstName-error');
      expect(errorEl.getAttribute('role')).toBe('alert');
    });

    it('NFR-A-EUD73-01: aria-invalid y aria-describedby también en mat-select inválido', () => {
      const ctrl = new FormControl('', { validators: [BUILTIN_VALIDATORS_FACTORY_MAP.required()] });
      const group = new FormGroup({ format: ctrl });
      componentRef.setInput('parentFormGroup$', group);
      componentRef.setInput('fieldName$', 'format');
      componentRef.setInput('fieldPath$', 'format');
      componentRef.setInput('fieldSchema$', controlField({
        key: 'format',
        controlType: 'selector',
        multiOptions: [{ label: 'A', value: 'a' }],
      }));
      ctrl.markAsTouched();
      fixture.detectChanges();

      const select = fixture.debugElement.query(By.css('mat-select')).nativeElement;
      expect(select.getAttribute('aria-invalid')).toBe('true');
      expect(select.getAttribute('aria-describedby')).toBe('format-error');
    });

    it('EC-04: el mensaje y los atributos ARIA desaparecen al corregir el valor', () => {
      const ctrl = new FormControl('', { validators: [BUILTIN_VALIDATORS_FACTORY_MAP.required()] });
      const group = new FormGroup({ firstName: ctrl });
      componentRef.setInput('parentFormGroup$', group);
      componentRef.setInput('fieldName$', 'firstName');
      componentRef.setInput('fieldPath$', 'firstName');
      componentRef.setInput('fieldSchema$', controlField());
      ctrl.markAsTouched();
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('mat-error'))).toBeTruthy();

      ctrl.setValue('Alice');
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('mat-error'))).toBeFalsy();
      const input = fixture.debugElement.query(By.css('input')).nativeElement;
      // aria-invalid lo gestiona matInput internamente (ErrorStateMatcher); ya no debe valer "true"
      expect(input.getAttribute('aria-invalid')).not.toBe('true');
      expect(input.getAttribute('aria-describedby')).toBeNull();
    });
  });
});
