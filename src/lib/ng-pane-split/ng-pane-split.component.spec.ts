import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgPaneSplitComponent } from './ng-pane-split.component';

describe('NgPaneSplitComponent', () => {
  let component: NgPaneSplitComponent;
  let fixture: ComponentFixture<NgPaneSplitComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgPaneSplitComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgPaneSplitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
