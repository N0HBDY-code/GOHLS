import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RosterComponent } from '../roster/roster.component';

@Component({
  selector: 'app-team-detail',
  standalone: true,
  imports: [CommonModule, RosterComponent],
  templateUrl: './team-detail.component.html',
  styleUrls: ['./team-detail.component.css']
})
export class TeamDetailComponent {
  teamId: string;

  constructor(private route: ActivatedRoute) {
    this.teamId = this.route.snapshot.paramMap.get('id')!;
  }
}
