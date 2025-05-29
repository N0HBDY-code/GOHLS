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
  allGames: Game[] = [];
  filteredGames: Game[] = [];
  selectedTeamId: string = '';
  selectedSeason: number = 1;
  availableSeasons = Array.from({ length: 10 }, (_, i) => i + 1);
  availableWeeks = Array.from({ length: 52 }, (_, i) => i + 1);
  availableDays = [
    'Sunday',
    'Monday', 
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ];
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
    await this.loadAllGames();
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

  async loadAllGames() {
    this.allGames = [];
    for (const team of this.teams) {
      const gamesRef = collection(this.firestore, `teams/${team.id}/games`);
      const snapshot = await getDocs(gamesRef);
      const games = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        homeTeam: this.getTeamName(doc.data()['homeTeamId']),
        awayTeam: this.getTeamName(doc.data()['awayTeamId'])
      } as Game));
      this.allGames.push(...games);
    }
    this.filterGames();
  }

  getTeamName(teamId: string): string {
    return this.teams.find(t => t.id === teamId)?.name || 'Unknown Team';
  }

  filterGames() {
    let filtered = [...this.allGames];
    
    if (this.selectedSeason) {
      filtered = filtered.filter(g => g.season === this.selectedSeason);
    }

    this.filteredGames = filtered.sort((a, b) => {
      if (a.week !== b.week) {
        return a.week - b.week;
      }
      return this.availableDays.indexOf(a.day) - this.availableDays.indexOf(b.day);
    });
  }

  async addGame() {
    if (!this.newGame.homeTeamId || !this.newGame.awayTeamId || !this.newGame.day || !this.newGame.week) {
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
      season: this.selectedSeason
    };

    await this.loadAllGames();
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
      
      this.allGames = [];
      this.filteredGames = [];
      await this.loadAllGames();
      
      alert('All games have been cleared successfully!');
    } catch (error) {
      console.error('Error clearing games:', error);
      alert('Error clearing games. Please check the console for details.');
    } finally {
      this.isClearing = false;
    }
  }
}