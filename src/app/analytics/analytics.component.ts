import { Component, OnInit } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  doc
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Team {
  id: string;
  name: string;
}

interface Game {
  id: string;
  date: string;
}

interface PlayerStats {
  points: number;
  assists: number;
  rebounds: number;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css'
})
export class AnalyticsComponent implements OnInit {
  teams: Team[] = [];
  selectedTeamId = '';
  totalGames = 0;
  totalPoints = 0;
  totalAssists = 0;
  totalRebounds = 0;

  constructor(private firestore: Firestore) {}

  async ngOnInit() {
    await this.loadTeams();
  }

  async loadTeams() {
    const teamsRef = collection(this.firestore, 'teams');
    const snapshot = await getDocs(teamsRef);
    this.teams = snapshot.docs.map(doc => ({
      id: doc.id,
      name: (doc.data() as any).name || 'Unnamed'
    }));
  }

  async onTeamSelect() {
    if (!this.selectedTeamId) return;

    this.totalGames = 0;
    this.totalPoints = 0;
    this.totalAssists = 0;
    this.totalRebounds = 0;

    const gamesRef = collection(this.firestore, `teams/${this.selectedTeamId}/games`);
    const gamesSnapshot = await getDocs(gamesRef);
    const games = gamesSnapshot.docs.map(doc => ({
      id: doc.id,
      date: (doc.data() as any).date
    })) as Game[];

    this.totalGames = games.length;

    for (const game of games) {
      const statsRef = collection(this.firestore, `teams/${this.selectedTeamId}/games/${game.id}/stats`);
      const statsSnapshot = await getDocs(statsRef);

      for (const statDoc of statsSnapshot.docs) {
        const stats = statDoc.data() as PlayerStats;
        this.totalPoints += stats.points || 0;
        this.totalAssists += stats.assists || 0;
        this.totalRebounds += stats.rebounds || 0;
      }
    }
  }

  get avgPoints(): number {
    return this.totalGames ? Math.round(this.totalPoints / this.totalGames) : 0;
  }

  get avgAssists(): number {
    return this.totalGames ? Math.round(this.totalAssists / this.totalGames) : 0;
  }

  get avgRebounds(): number {
    return this.totalGames ? Math.round(this.totalRebounds / this.totalGames) : 0;
  }

  get selectedTeamName(): string {
    const team = this.teams.find(t => t.id === this.selectedTeamId);
    return team ? team.name : '';
  }
}