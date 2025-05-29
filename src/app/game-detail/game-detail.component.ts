import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';

type GamePeriod = '1st' | '2nd' | '3rd' | 'OT' | 'Final';

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
  canEditScores = false;
  isEditing = false;
  currentPeriod: GamePeriod = '1st';
  periods: GamePeriod[] = ['1st', '2nd', '3rd', 'OT', 'Final'];

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private authService: AuthService
  ) {
    this.gameId = this.route.snapshot.paramMap.get('gameId') || '';
    this.teamId = this.route.snapshot.paramMap.get('teamId') || '';
  }

  async ngOnInit() {
    // Check user roles
    this.authService.effectiveRoles.subscribe(roles => {
      this.canEditScores = roles.some(role => 
        ['developer', 'commissioner', 'stats monkey', 'gm'].includes(role)
      );
    });

    await this.loadGameData();
  }

  async loadGameData() {
    if (this.gameId && this.teamId) {
      const gameRef = doc(this.firestore, `teams/${this.teamId}/games/${this.gameId}`);
      const gameSnap = await getDoc(gameRef);
      
      if (gameSnap.exists()) {
        this.game = { id: gameSnap.id, ...gameSnap.data() };
        
        // Load existing scores and period if they exist
        this.awayScore = this.game.awayScore || 0;
        this.homeScore = this.game.homeScore || 0;
        this.currentPeriod = this.game.period || '1st';
        
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
    if (!this.game || !this.canEditScores) return;

    // Update scores in both team's game records
    const homeGameRef = doc(this.firestore, `teams/${this.game.homeTeamId}/games/${this.gameId}`);
    const awayGameRef = doc(this.firestore, `teams/${this.game.awayTeamId}/games/${this.gameId}`);

    const scoreData = {
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      period: this.currentPeriod
    };

    await Promise.all([
      updateDoc(homeGameRef, scoreData),
      updateDoc(awayGameRef, scoreData)
    ]);

    // Reload game data to confirm changes
    await this.loadGameData();
    this.isEditing = false;
  }

  toggleEdit() {
    if (!this.canEditScores) return;
    
    if (this.isEditing) {
      this.saveScores();
    } else {
      this.isEditing = true;
    }
  }

  async updatePeriod(period: GamePeriod) {
    if (!this.canEditScores) return;
    
    this.currentPeriod = period;
    await this.saveScores();
  }
}