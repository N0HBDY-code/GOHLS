import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';
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
  awayTeamLogo: string = '';
  awayTeamName: string = '';
  homeTeamLogo: string = '';
  homeTeamName: string = '';
  awayScore: number = 0;
  homeScore: number = 0;

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
        
        // Load existing scores if they exist
        this.awayScore = this.game.awayScore || 0;
        this.homeScore = this.game.homeScore || 0;
        
        // Get home team details
        const homeTeamRef = doc(this.firestore, `teams/${this.game.homeTeamId}`);
        const homeTeamSnap = await getDoc(homeTeamRef);
        if (homeTeamSnap.exists()) {
          const homeTeamData = homeTeamSnap.data();
          this.homeTeamLogo = homeTeamData['logoUrl'] || '';
          this.homeTeamName = homeTeamData['mascot'] || '';
        }

        // Get away team details
        const awayTeamRef = doc(this.firestore, `teams/${this.game.awayTeamId}`);
        const awayTeamSnap = await getDoc(awayTeamRef);
        if (awayTeamSnap.exists()) {
          const awayTeamData = awayTeamSnap.data();
          this.awayTeamLogo = awayTeamData['logoUrl'] || '';
          this.awayTeamName = awayTeamData['mascot'] || '';
        }
      }
    }
    this.loading = false;
  }

  async saveScores() {
    if (!this.game) return;

    // Update scores in both team's game records
    const homeGameRef = doc(this.firestore, `teams/${this.game.homeTeamId}/games/${this.gameId}`);
    const awayGameRef = doc(this.firestore, `teams/${this.game.awayTeamId}/games/${this.gameId}`);

    const scoreData = {
      homeScore: this.homeScore,
      awayScore: this.awayScore
    };

    await updateDoc(homeGameRef, scoreData);
    await updateDoc(awayGameRef, scoreData);
  }
}