import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RosterComponent } from '../roster/roster.component';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-team-detail',
  standalone: true,
  imports: [CommonModule, RosterComponent],
  templateUrl: './team-detail.component.html',
  styleUrls: ['./team-detail.component.css']
})
export class TeamDetailComponent implements OnInit {
  teamId: string;
  teamName: string = '';
  teamLogo: string = '';

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore
  ) {
    this.teamId = this.route.snapshot.paramMap.get('id')!;
  }

  async ngOnInit() {
    if (this.teamId) {
      const teamRef = doc(this.firestore, `teams/${this.teamId}`);
      const teamSnap = await getDoc(teamRef);
      if (teamSnap.exists()) {
        const data = teamSnap.data();
        this.teamName = `${data['city']} ${data['mascot']}`;
        this.teamLogo = data['logoUrl'] || '';
      }
    }
  }
}