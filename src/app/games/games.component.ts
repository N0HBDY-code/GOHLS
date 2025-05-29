import { Component, OnInit } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  doc,
  query,
  where,
  writeBatch,
  addDoc
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
      const dates = this.schedule.map(g => new Date(g.date));
      const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const endDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      this.seasonStartDate = startDate.toISOString().split('T')[0];
      this.seasonEndDate = endDate.toISOString().split('T')[0];
      this.currentMonth = startDate;
      this.generateCalendar();
    }
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

    const startDate = new Date(this.seasonStartDate);
    const endDate = new Date(this.seasonEndDate);
    
    // Pre-calculate all available dates
    const availableDates = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (this.gameDays[d.getDay()]) {
        availableDates.push(new Date(d));
      }
    }

    if (availableDates.length === 0) {
      alert('No available dates found. Please select at least one game day.');
      return;
    }

    try {
      const batch = writeBatch(this.firestore);
      const schedule: Game[] = [];
      let batchCount = 0;
      const MAX_BATCH_SIZE = 500;

      // Pre-calculate opponents for each team
      const teamOpponents = new Map<string, {
        division: Team[],
        conference: Team[],
        other: Team[]
      }>();

      for (const team of this.teams) {
        teamOpponents.set(team.id, {
          division: this.teams.filter(t => t.id !== team.id && t.division === team.division),
          conference: this.teams.filter(t => t.id !== team.id && t.conference === team.conference && t.division !== team.division),
          other: this.teams.filter(t => t.conference !== team.conference)
        });
      }

      // Generate all games at once
      for (const team of this.teams) {
        const opponents = teamOpponents.get(team.id)!;
        
        // Division games
        const gamesPerDivOpponent = Math.floor(this.divisionGames / opponents.division.length);
        for (const opponent of opponents.division) {
          const games = this.generateGamesForPair(team, opponent, gamesPerDivOpponent, availableDates, schedule, 'division');
          schedule.push(...games);
        }

        // Conference games
        const gamesPerConfOpponent = Math.floor(this.conferenceGames / opponents.conference.length);
        for (const opponent of opponents.conference) {
          const games = this.generateGamesForPair(team, opponent, gamesPerConfOpponent, availableDates, schedule, 'conference');
          schedule.push(...games);
        }

        // Other conference games
        const gamesPerOtherOpponent = Math.floor(this.otherConferenceGames / opponents.other.length);
        for (const opponent of opponents.other) {
          const games = this.generateGamesForPair(team, opponent, gamesPerOtherOpponent, availableDates, schedule, 'interconference');
          schedule.push(...games);
        }
      }

      // Save games in batches
      for (const game of schedule) {
        const teamARef = doc(collection(this.firestore, `teams/${game.teamAId}/games`));
        const teamBRef = doc(collection(this.firestore, `teams/${game.teamBId}/games`));
        
        batch.set(teamARef, { ...game, timestamp: new Date() });
        batch.set(teamBRef, { ...game, timestamp: new Date() });
        
        batchCount += 2;
        
        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      this.schedule = schedule.sort((a, b) => a.date.localeCompare(b.date));
      this.generateCalendar();
      
      alert('Schedule generated successfully!');
      await this.onTeamSelect();
    } catch (error) {
      console.error('Error generating schedule:', error);
      alert('Error generating schedule. Please try again.');
    }
  }

  private generateGamesForPair(teamA: Team, teamB: Team, gamesCount: number, availableDates: Date[], existingSchedule: Game[], tag: string): Game[] {
    const games: Game[] = [];
    let homeGames = Math.floor(gamesCount / 2);
    let awayGames = gamesCount - homeGames;

    while (homeGames > 0 || awayGames > 0) {
      const date = this.findAvailableDate(availableDates, existingSchedule, teamA.name, teamB.name);
      if (!date) break;

      const isHome = homeGames > awayGames;
      const game = {
        teamAId: teamA.id,
        teamBId: teamB.id,
        date: date.toISOString().split('T')[0],
        homeTeam: isHome ? teamA.name : teamB.name,
        awayTeam: isHome ? teamB.name : teamA.name,
        homeLogo: isHome ? teamA.logoUrl : teamB.logoUrl,
        awayLogo: isHome ? teamB.logoUrl : teamA.logoUrl,
        season: this.season,
        tags: [tag]
      };

      games.push(game);
      if (isHome) homeGames--;
      else awayGames--;
    }

    return games;
  }

  private findAvailableDate(availableDates: Date[], schedule: Game[], teamA: string, teamB: string): Date | null {
    const shuffledDates = [...availableDates].sort(() => Math.random() - 0.5);
    
    for (const date of shuffledDates) {
      const dateStr = date.toISOString().split('T')[0];
      const gamesOnDate = schedule.filter(g => g.date === dateStr);
      
      if (gamesOnDate.length < 3 && 
          !schedule.some(g => 
            g.date === dateStr && 
            (g.homeTeam === teamA || g.awayTeam === teamA || g.homeTeam === teamB || g.awayTeam === teamB)
          )) {
        return date;
      }
    }
    return null;
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