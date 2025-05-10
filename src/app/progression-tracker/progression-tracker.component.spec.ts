import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProgressionTrackerComponent } from './progression-tracker.component';

describe('ProgressionTrackerComponent', () => {
  let component: ProgressionTrackerComponent;
  let fixture: ComponentFixture<ProgressionTrackerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProgressionTrackerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProgressionTrackerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
