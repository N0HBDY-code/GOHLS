import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';

type GamePeriod = '1st' | '2nd' | '3rd' | 'OT' | 'Final';

interface GameStats {
  totalShots: number;
  hits: number;
  timeOnAttack: { minutes: number; seconds: number };
  passingPercentage: number;
  faceoffsWon: number;
  penaltyMinutes: number;
  powerplays: { successful: number; total: number };
  powerplayMinutes: number;
  shorthandedGoals: number;
}

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

  homeStats: GameStats = {
    totalShots: 0,
    hits: 0,
    timeOnAttack: { minutes: 0, seconds: 0 },
    passingPercentage: 0,
    faceoffsWon: 0,
    penaltyMinutes: 0,
    powerplays: { successful: 0, total: 0 },
    powerplayMinutes: 0,
    shorthandedGoals: 0
  };

  awayStats: GameStats = {
    totalShots: 0,
    hits: 0,
    timeOnAttack: { minutes: 0, seconds: 0 },
    passingPercentage: 0,
    faceoffsWon: 0,
    penaltyMinutes: 0,
    powerplays: { successful: 0, total: 0 },
    powerplayMinutes: 0,
    shorthandedGoals: 0
  };

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private authService: AuthService
  ) {
    this.gameId = this.route.snapshot.paramMap.get('gameId') || '';
    this.teamId = this.route.snapshot.paramMap.get('teamId') || '';
  }

  async ngOnInit() {
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
        
        this.awayScore = this.game.awayScore || 0;
        this.homeScore = this.game.homeScore || 0;
        this.currentPeriod = this.game.period || '1st';
        
        // Load stats if they exist
        if (this.game.homeStats) {
          this.homeStats = { ...this.homeStats, ...this.game.homeStats };
        }
        if (this.game.awayStats) {
          this.awayStats = { ...this.awayStats, ...this.game.awayStats };
        }
        
        const homeTeamRef = doc(this.firestore, `teams/${this.game.homeTeamId}`);
        const homeTeamSnap = await getDoc(homeTeamRef);
        if (homeTeamSnap.exists()) {
          const homeTeamData = homeTeamSnap.data();
          this.homeTeamLogo = homeTeamData['logoUrl'] || '';
          this.homeTeamName = homeTeamData['mascot'] || '';
        }

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

  async saveGameData() {
    if (!this.game || !this.canEditScores) return;

    const gameData = {
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      period: this.currentPeriod,
      homeStats: this.homeStats,
      awayStats: this.awayStats
    };

    const homeGameRef = doc(this.firestore, `teams/${this.game.homeTeamId}/games/${this.gameId}`);
    const awayGameRef = doc(this.firestore, `teams/${this.game.awayTeamId}/games/${this.gameId}`);

    await Promise.all([
      updateDoc(homeGameRef, gameData),
      updateDoc(awayGameRef, gameData)
    ]);

    await this.loadGameData();
    this.isEditing = false;
  }

  toggleEdit() {
    if (!this.canEditScores) return;
    
    if (this.isEditing) {
      this.saveGameData();
    } else {
      this.isEditing = true;
    }
  }

  async updatePeriod(period: GamePeriod) {
    if (!this.canEditScores) return;
    
    this.currentPeriod = period;
    await this.saveGameData();
  }

  formatTime(minutes: number, seconds: number): string {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  formatPowerplays(successful: number, total: number): string {
    return `${successful}/${total}`;
  }
}