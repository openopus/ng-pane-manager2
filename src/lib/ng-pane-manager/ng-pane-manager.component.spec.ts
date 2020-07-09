import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgPaneManagerComponent } from './ng-pane-manager.component';

describe('NgPaneManagerComponent', () => {
  let component: NgPaneManagerComponent;
  let fixture: ComponentFixture<NgPaneManagerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgPaneManagerComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgPaneManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
