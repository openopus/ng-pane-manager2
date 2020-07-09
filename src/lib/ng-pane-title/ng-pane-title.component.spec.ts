import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgPaneTitleComponent } from './ng-pane-title.component';

describe('NgPaneTitleComponent', () => {
  let component: NgPaneTitleComponent;
  let fixture: ComponentFixture<NgPaneTitleComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgPaneTitleComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgPaneTitleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
