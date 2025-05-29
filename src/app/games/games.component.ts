import { Component, OnInit } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  addDoc,
  doc,
  query,
  where,
  deleteDoc
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Team {
  id: string;
  name: string;
  conference: string;
  division: string;
}

interface Game {
  id?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  week: number;
  day: string;
  season: number;
  tags?: string[];
}

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './games.component.html',
  styleUrls: ['./games.component.css']
})
export class GamesComponent implements OnInit {
  teams: Team[] = [];
  games: Game[] = [];
  isClearing = false;

  newGame = {
    homeTeamId: '',
    awayTeamId: '',
    week: 1,
    day: '',
    season: 1
  };

  constructor(private firestore: Firestore) {}

  async ngOnInit() {
    await this.loadTeams();
    await this.loadGames();
  }

  async loadTeams() {
    const snapshot = await getDocs(collection(this.firestore, 'teams'));
    this.teams = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['name'] || 'Unnamed',
      conference: doc.data()['conference'],
      division: doc.data()['division']
    }));
  }

  async loadGames() {
    const allGames = new Map<string, Game>();
    
    for (const team of this.teams) {
      const gamesRef = collection(this.firestore, `teams/${team.id}/games`);
      const snapshot = await getDocs(gamesRef);
      
      snapshot.docs.forEach(doc => {
        const gameData = doc.data();
        const gameKey = `${gameData['week']}-${gameData['day']}-${gameData['homeTeamId']}-${gameData['awayTeamId']}`;
        
        if (!allGames.has(gameKey)) {
          allGames.set(gameKey, {
            id: doc.id,
            ...gameData,
            homeTeam: this.getTeamName(gameData['homeTeamId']),
            awayTeam: this.getTeamName(gameData['awayTeamId'])
          } as Game);
        }
      });
    }
    
    this.games = Array.from(allGames.values()).sort((a, b) => {
      if (a.week !== b.week) {
        return a.week - b.week;
      }
      return a.day.localeCompare(b.day);
    });
  }

  getTeamName(teamId: string): string {
    return this.teams.find(t => t.id === teamId)?.name || 'Unknown Team';
  }

  async addGame() {
    if (!this.newGame.homeTeamId || !this.newGame.awayTeamId || !this.newGame.day) {
      alert('Please fill in all required fields');
      return;
    }

    const homeTeam = this.teams.find(t => t.id === this.newGame.homeTeamId);
    const awayTeam = this.teams.find(t => t.id === this.newGame.awayTeamId);
    
    if (!homeTeam || !awayTeam) return;

    const tags: string[] = [];
    if (homeTeam.division === awayTeam.division) {
      tags.push('division');
    } else if (homeTeam.conference === awayTeam.conference) {
      tags.push('conference');
    } else {
      tags.push('interconference');
    }

    const gameData = {
      ...this.newGame,
      tags
    };

    // Add to home team's games
    await addDoc(collection(this.firestore, `teams/${this.newGame.homeTeamId}/games`), gameData);
    // Add to away team's games
    await addDoc(collection(this.firestore, `teams/${this.newGame.awayTeamId}/games`), gameData);

    this.newGame = {
      homeTeamId: '',
      awayTeamId: '',
      week: 1,
      day: '',
      season: 1
    };

    await this.loadGames();
  }

  async clearAllGames() {
    if (!confirm('Are you sure you want to delete ALL games? This cannot be undone!')) {
      return;
    }

    this.isClearing = true;
    try {
      for (const team of this.teams) {
        const gamesRef = collection(this.firestore, `teams/${team.id}/games`);
        const snapshot = await getDocs(gamesRef);
        
        for (const doc of snapshot.docs) {
          await deleteDoc(doc.ref);
        }
      }
      
      this.games = [];
      await this.loadGames();
      
      alert('All games have been cleared successfully!');
    } catch (error) {
      console.error('Error clearing games:', error);
      alert('Error clearing games. Please check the console for details.');
    } finally {
      this.isClearing = false;
    }
  }
}