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
  date: string;
  season: number;
  tags?: string[];
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  games: Game[];
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
  calendarDays: CalendarDay[] = [];
  currentMonth = new Date();
  
  viewMode: 'all' | 'team' = 'all';
  selectedTeamId: string = '';
  selectedSeason: number = 1;
  availableSeasons = Array.from({ length: 10 }, (_, i) => i + 1);
  filterTags: string[] = [];
  isClearing = false;

  newGame = {
    homeTeamId: '',
    awayTeamId: '',
    date: '',
    season: 1
  };

  constructor(private firestore: Firestore) {}

  async ngOnInit() {
    await this.loadTeams();
    await this.loadAllGames();
    this.generateCalendar();
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

  async onTeamSelect() {
    await this.loadAllGames();
  }

  onViewModeChange() {
    this.selectedTeamId = '';
    this.loadAllGames();
  }

  filterGames() {
    let filtered = [...this.allGames];
    
    if (this.selectedSeason) {
      filtered = filtered.filter(g => g.season === this.selectedSeason);
    }

    if (this.viewMode === 'team' && this.selectedTeamId) {
      filtered = filtered.filter(g => 
        g.homeTeamId === this.selectedTeamId || 
        g.awayTeamId === this.selectedTeamId
      );
    }

    if (this.filterTags.length > 0) {
      filtered = filtered.filter(g => 
        g.tags?.some(tag => this.filterTags.includes(tag))
      );
    }

    this.filteredGames = filtered;
    this.generateCalendar();
  }

  toggleTag(tag: string) {
    const index = this.filterTags.indexOf(tag);
    if (index === -1) {
      this.filterTags.push(tag);
    } else {
      this.filterTags.splice(index, 1);
    }
    this.filterGames();
  }

  async addGame() {
    if (!this.newGame.homeTeamId || !this.newGame.awayTeamId || !this.newGame.date) {
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
      date: '',
      season: this.selectedSeason
    };

    await this.loadAllGames();
  }

  generateCalendar() {
    const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const lastDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
    
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    this.calendarDays = [];
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      const dayGames = this.filteredGames.filter(game => {
        const gameDate = new Date(game.date);
        return gameDate.toDateString() === date.toDateString();
      });

      this.calendarDays.push({
        date: new Date(date),
        isCurrentMonth: date.getMonth() === this.currentMonth.getMonth(),
        games: dayGames
      });
    }
  }

  previousMonth() {
    this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
    this.generateCalendar();
  }

  nextMonth() {
    this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
    this.generateCalendar();
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
      this.calendarDays = [];
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