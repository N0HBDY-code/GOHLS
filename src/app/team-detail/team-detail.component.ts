import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-team-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team-detail.component.html',
})
export class TeamDetailComponent implements OnInit {
  private firestore = inject(Firestore);
  private route = inject(ActivatedRoute);
  teamId!: string;
  team: any;

  async ngOnInit() {
    this.teamId = this.route.snapshot.paramMap.get('id')!;
    const docRef = doc(this.firestore, 'teams', this.teamId);
    const snapshot = await getDoc(docRef);
    this.team = snapshot.exists() ? snapshot.data() : null;
  }
}
