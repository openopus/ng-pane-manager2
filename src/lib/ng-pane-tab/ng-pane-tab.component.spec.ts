import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgPaneTabComponent } from './ng-pane-tab.component';

describe('NgPaneTabComponent', () => {
  let component: NgPaneTabComponent;
  let fixture: ComponentFixture<NgPaneTabComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgPaneTabComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgPaneTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
