import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgPaneHeaderComponent } from './ng-pane-header.component';

describe('NgPaneHeaderComponent', () => {
  let component: NgPaneHeaderComponent;
  let fixture: ComponentFixture<NgPaneHeaderComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgPaneHeaderComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgPaneHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
