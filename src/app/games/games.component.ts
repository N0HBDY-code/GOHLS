import { Component, OnInit } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  addDoc,
  doc,
  query,
  where
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Team {
  id: string;
  name: string;
  conference: string;
  division: string;
  logoUrl?: string;
}

interface Game {
  id?: string;
  teamAId: string;
  teamBId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  tags?: string[];
  season: number;
}

interface CalendarDay {
  date: Date;
  games: Game[];
  isCurrentMonth: boolean;
}

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './games.component.html',
  styleUrl: './games.component.css'
})
export class GamesComponent implements OnInit {
  teams: Team[] = [];
  allGames: Game[] = [];
  filteredGames: Game[] = [];
  calendarDays: CalendarDay[] = [];
  selectedTeamId: string = '';
  availableSeasons: number[] = [];
  selectedSeason: number = 1;
  currentMonth: Date = new Date();
  viewMode: 'all' | 'team' = 'all';
  filterTags: string[] = [];

  // New game form
  newGame = {
    homeTeamId: '',
    awayTeamId: '',
    date: '',
    season: 1
  };

  constructor(private firestore: Firestore) {}

  async ngOnInit() {
    const snapshot = await getDocs(collection(this.firestore, 'teams'));
    this.teams = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['name'] || 'Unnamed',
      conference: doc.data()['conference'] || 'Unknown',
      division: doc.data()['division'] || 'Unknown',
      logoUrl: doc.data()['logoUrl'] || ''
    }));
    await this.loadAllGames();
  }

  async loadAllGames() {
    const allGames: Game[] = [];
    const seasons = new Set<number>();

    for (const team of this.teams) {
      const gamesRef = collection(this.firestore, `teams/${team.id}/games`);
      const snapshot = await getDocs(gamesRef);
      snapshot.docs.forEach(doc => {
        const game = { id: doc.id, ...doc.data() } as Game;
        if (!allGames.some(g => 
          g.date === game.date && 
          ((g.teamAId === game.teamAId && g.teamBId === game.teamBId) ||
           (g.teamAId === game.teamBId && g.teamBId === game.teamAId))
        )) {
          allGames.push(game);
          seasons.add(game.season);
        }
      });
    }

    this.allGames = allGames.sort((a, b) => a.date.localeCompare(b.date));
    this.availableSeasons = Array.from(seasons).sort((a, b) => a - b);
    
    if (this.availableSeasons.length > 0) {
      this.selectedSeason = this.availableSeasons[0];
    } else {
      this.availableSeasons.push(1);
    }
    
    this.filterGames();
  }

  async addGame() {
    if (!this.newGame.homeTeamId || !this.newGame.awayTeamId || !this.newGame.date) {
      alert('Please fill in all game details');
      return;
    }

    const homeTeam = this.teams.find(t => t.id === this.newGame.homeTeamId);
    const awayTeam = this.teams.find(t => t.id === this.newGame.awayTeamId);

    if (!homeTeam || !awayTeam) return;

    const tag = this.determineGameType(homeTeam, awayTeam);
    const game: Game = {
      teamAId: homeTeam.id,
      teamBId: awayTeam.id,
      date: this.newGame.date,
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
      homeLogo: homeTeam.logoUrl,
      awayLogo: awayTeam.logoUrl,
      season: this.newGame.season,
      tags: [tag]
    };

    // Add to both teams' collections
    await addDoc(collection(this.firestore, `teams/${homeTeam.id}/games`), game);
    await addDoc(collection(this.firestore, `teams/${awayTeam.id}/games`), game);

    // Reset form
    this.newGame = {
      homeTeamId: '',
      awayTeamId: '',
      date: '',
      season: this.newGame.season
    };

    await this.loadAllGames();
  }

  private determineGameType(homeTeam: Team, awayTeam: Team): string {
    if (homeTeam.division === awayTeam.division) return 'division';
    if (homeTeam.conference === awayTeam.conference) return 'conference';
    return 'interconference';
  }

  filterGames() {
    this.filteredGames = this.allGames.filter(game => {
      const matchesSeason = game.season === this.selectedSeason;
      const matchesTeam = this.viewMode === 'all' || !this.selectedTeamId || 
        game.teamAId === this.selectedTeamId || game.teamBId === this.selectedTeamId;
      const matchesTags = this.filterTags.length === 0 || 
        this.filterTags.some(tag => game.tags?.includes(tag));
      
      return matchesSeason && matchesTeam && matchesTags;
    });

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

  onTeamSelect() {
    this.filterGames();
  }

  onViewModeChange() {
    if (this.viewMode === 'all') {
      this.selectedTeamId = '';
    }
    this.filterGames();
  }

  generateCalendar() {
    this.calendarDays = [];
    if (!this.currentMonth) return;

    const firstDayOfMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);

    const firstDay = new Date(firstDayOfMonth);
    firstDay.setDate(firstDay.getDate() - firstDay.getDay());

    const lastDay = new Date(lastDayOfMonth);
    lastDay.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const dayGames = this.filteredGames.filter(game => {
        const gameDate = new Date(game.date);
        return gameDate.toDateString() === d.toDateString();
      });

      this.calendarDays.push({
        date: new Date(d),
        games: dayGames,
        isCurrentMonth: d.getMonth() === this.currentMonth.getMonth()
      });
    }
  }

  previousMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1);
    this.generateCalendar();
  }

  nextMonth() {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1);
    this.generateCalendar();
  }

  getDayName(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  getMonthName(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long' });
  }
}