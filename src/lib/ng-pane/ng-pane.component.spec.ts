import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgPaneComponent } from './ng-pane.component';

describe('NgPaneComponent', () => {
  let component: NgPaneComponent;
  let fixture: ComponentFixture<NgPaneComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgPaneComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgPaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
