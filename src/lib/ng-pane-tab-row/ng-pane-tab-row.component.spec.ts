import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgPaneTabRowComponent } from './ng-pane-tab-row.component';

describe('NgPaneTabRowComponent', () => {
  let component: NgPaneTabRowComponent;
  let fixture: ComponentFixture<NgPaneTabRowComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgPaneTabRowComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgPaneTabRowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
