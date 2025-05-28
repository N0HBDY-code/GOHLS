import { Component, OnInit } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  doc,
  query,
  where,
  writeBatch
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
  schedule: Game[] = [];
  calendarDays: CalendarDay[] = [];
  selectedTeamId: string = '';
  availableSeasons: number[] = [];
  selectedSeason: number = 1;
  currentMonth: Date = new Date();

  // Schedule Generation Parameters
  season: number = 1;
  seasonStartDate: string = '';
  seasonEndDate: string = '';
  gameDays: boolean[] = [false, false, false, false, false, false, false]; // Sun-Sat
  totalGames: number = 82;
  divisionGames: number = 32;
  conferenceGames: number = 30;
  otherConferenceGames: number = 20;

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
  }

  async onTeamSelect() {
    if (!this.selectedTeamId) return;
    
    // First, get all available seasons for this team
    const gamesRef = collection(this.firestore, `teams/${this.selectedTeamId}/games`);
    const snapshot = await getDocs(gamesRef);
    const seasons = new Set(snapshot.docs.map(doc => doc.data()['season']));
    this.availableSeasons = Array.from(seasons).sort((a, b) => a - b);
    
    if (this.availableSeasons.length > 0) {
      this.selectedSeason = this.availableSeasons[0];
      await this.loadSeasonGames();
    }
  }

  async loadSeasonGames() {
    if (!this.selectedTeamId || !this.selectedSeason) return;
    
    const gamesRef = collection(this.firestore, `teams/${this.selectedTeamId}/games`);
    const q = query(gamesRef, where('season', '==', this.selectedSeason));
    const snapshot = await getDocs(q);
    this.schedule = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
    
    if (this.schedule.length > 0) {
      // Set date range based on first and last game
      const dates = this.schedule.map(g => new Date(g.date));
      const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const endDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      this.seasonStartDate = startDate.toISOString().split('T')[0];
      this.seasonEndDate = endDate.toISOString().split('T')[0];
      
      // Set current month to first month of season
      this.currentMonth = startDate;
      this.generateCalendar();
    }
  }

  generateCalendar() {
    this.calendarDays = [];
    if (!this.currentMonth) return;

    const firstDayOfMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
    const lastDayOfMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);

    // Get the first day to display (last days of previous month if month doesn't start on Sunday)
    const firstDay = new Date(firstDayOfMonth);
    firstDay.setDate(firstDay.getDate() - firstDay.getDay());

    // Get the last day to display (first days of next month if month doesn't end on Saturday)
    const lastDay = new Date(lastDayOfMonth);
    lastDay.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const dayGames = this.schedule.filter(game => {
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

  isGameDay(date: Date): boolean {
    return this.gameDays[date.getDay()];
  }

  async generateSchedule() {
    if (!this.validateScheduleParams()) return;

    const schedule: Game[] = [];
    const availableDates: Date[] = [];
    
    const startDate = new Date(this.seasonStartDate);
    const endDate = new Date(this.seasonEndDate);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (this.gameDays[d.getDay()]) {
        availableDates.push(new Date(d));
      }
    }

    if (availableDates.length === 0) {
      alert('No available dates found. Please select at least one game day.');
      return;
    }

    const matchups = new Set<string>();
    const getKey = (a: string, b: string) => [a, b].sort().join('-');

    const getRandomDate = (): Date => {
      let attempts = 0;
      while (attempts++ < 100) {
        const date = availableDates[Math.floor(Math.random() * availableDates.length)];
        const dateStr = date.toISOString().split('T')[0];
        const count = schedule.filter(g => g.date === dateStr).length;
        if (count < 3) return date; // Max 3 games per day
      }
      return availableDates[0];
    };

    const canPlay = (team: string, date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      return !schedule.some(g => (g.homeTeam === team || g.awayTeam === team) && g.date === dateStr);
    };

    const scheduleGames = (teamA: Team, teamB: Team, count: number) => {
      const key = getKey(teamA.id, teamB.id);
      if (matchups.has(key)) return;

      for (let i = 0; i < count; i++) {
        const date = getRandomDate();
        if (canPlay(teamA.name, date) && canPlay(teamB.name, date)) {
          const dateStr = date.toISOString().split('T')[0];
          const home = Math.random() < 0.5 ? teamA : teamB;
          const away = home.id === teamA.id ? teamB : teamA;
          
          schedule.push({
            teamAId: teamA.id,
            teamBId: teamB.id,
            date: dateStr,
            homeTeam: home.name,
            awayTeam: away.name,
            homeLogo: home.logoUrl,
            awayLogo: away.logoUrl,
            season: this.season,
            tags: teamA.division === teamB.division ? ['division'] :
                  teamA.conference === teamB.conference ? ['conference'] : ['interconference']
          });
        }
      }
      matchups.add(key);
    };

    // Schedule games for all teams
    for (const teamA of this.teams) {
      const sameDiv = this.teams.filter(t => 
        t.id !== teamA.id && t.division === teamA.division);
      const sameConf = this.teams.filter(t => 
        t.id !== teamA.id && t.conference === teamA.conference && t.division !== teamA.division);
      const otherConf = this.teams.filter(t => 
        t.conference !== teamA.conference);

      // Division games
      for (const teamB of sameDiv) {
        scheduleGames(teamA, teamB, 
          Math.floor(this.divisionGames / (sameDiv.length * 2)));
      }

      // Conference games (non-division)
      for (const teamB of sameConf) {
        scheduleGames(teamA, teamB,
          Math.floor(this.conferenceGames / (sameConf.length * 2)));
      }

      // Other conference games
      for (const teamB of otherConf) {
        scheduleGames(teamA, teamB,
          Math.floor(this.otherConferenceGames / (otherConf.length * 2)));
      }
    }

    try {
      // Save schedule to Firestore in batches
      const batchSize = 400; // Firestore limit is 500 operations per batch
      for (let i = 0; i < schedule.length; i += batchSize) {
        const batch = writeBatch(this.firestore);
        const chunk = schedule.slice(i, i + batchSize);
        
        for (const game of chunk) {
          // Save game for team A
          const teamARef = doc(collection(this.firestore, `teams/${game.teamAId}/games`));
          batch.set(teamARef, { ...game, season: this.season });

          // Save game for team B
          const teamBRef = doc(collection(this.firestore, `teams/${game.teamBId}/games`));
          batch.set(teamBRef, { ...game, season: this.season });
        }

        await batch.commit();
      }

      this.schedule = schedule.sort((a, b) => a.date.localeCompare(b.date));
      this.generateCalendar();
      
      alert('Schedule generated successfully!');
      
      // Refresh available seasons
      await this.onTeamSelect();
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Error saving schedule. Please try again.');
    }
  }

  validateScheduleParams(): boolean {
    if (!this.seasonStartDate || !this.seasonEndDate) {
      alert('Please select season start and end dates');
      return false;
    }

    if (!this.gameDays.some(day => day)) {
      alert('Please select at least one game day');
      return false;
    }

    if (this.divisionGames + this.conferenceGames + this.otherConferenceGames !== this.totalGames) {
      alert('Game distribution must equal total games');
      return false;
    }

    return true;
  }

  getDayName(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  getMonthName(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long' });
  }
}