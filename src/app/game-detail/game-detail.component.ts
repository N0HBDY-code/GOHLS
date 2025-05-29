import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-game-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './game-detail.component.html',
  styleUrls: ['./game-detail.component.css']
})
export class GameDetailComponent implements OnInit {
  gameId: string;
  teamId: string;
  game: any;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore
  ) {
    this.gameId = this.route.snapshot.paramMap.get('gameId') || '';
    this.teamId = this.route.snapshot.paramMap.get('teamId') || '';
  }

  async ngOnInit() {
    if (this.gameId && this.teamId) {
      const gameRef = doc(this.firestore, `teams/${this.teamId}/games/${this.gameId}`);
      const gameSnap = await getDoc(gameRef);
      if (gameSnap.exists()) {
        this.game = { id: gameSnap.id, ...gameSnap.data() };
      }
    }
    this.loading = false;
  }
}