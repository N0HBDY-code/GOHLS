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
  allGames: Game[] = [];
  filteredGames: Game[] = [];
  calendarDays: CalendarDay[] = [];
  selectedTeamId: string = '';
  availableSeasons: number[] = [];
  selectedSeason: number = 1;
  currentMonth: Date = new Date();
  viewMode: 'all' | 'team' = 'all';
  filterTags: string[] = [];

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
    await this.loadAllGames();
  }

  async loadAllGames() {
    const allGames: Game[] = [];
    const seasons = new Set<number>();

    // Load games in chunks to avoid memory issues
    const chunkSize = 5;
    for (let i = 0; i < this.teams.length; i += chunkSize) {
      const teamChunk = this.teams.slice(i, i + chunkSize);
      const promises = teamChunk.map(async team => {
        const gamesRef = collection(this.firestore, `teams/${team.id}/games`);
        const snapshot = await getDocs(gamesRef);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      });

      const chunkGames = await Promise.all(promises);
      chunkGames.flat().forEach(game => {
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
      this.filterGames();
    }
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
      const schedule: Game[] = [];
      const CHUNK_SIZE = 100; // Process games in smaller chunks

      // Generate division games
      for (const team of this.teams) {
        const divisionTeams = this.teams.filter(t => 
          t.id !== team.id && t.division === team.division
        );
        const gamesPerTeam = Math.floor(this.divisionGames / divisionTeams.length);
        
        for (const opponent of divisionTeams) {
          const games = this.generateGamesForPair(
            team, opponent, gamesPerTeam, availableDates, schedule, 'division'
          );
          schedule.push(...games);
        }
      }

      // Generate conference games
      for (const team of this.teams) {
        const conferenceTeams = this.teams.filter(t => 
          t.id !== team.id && 
          t.conference === team.conference && 
          t.division !== team.division
        );
        const gamesPerTeam = Math.floor(this.conferenceGames / conferenceTeams.length);
        
        for (const opponent of conferenceTeams) {
          const games = this.generateGamesForPair(
            team, opponent, gamesPerTeam, availableDates, schedule, 'conference'
          );
          schedule.push(...games);
        }
      }

      // Generate inter-conference games
      for (const team of this.teams) {
        const otherTeams = this.teams.filter(t => 
          t.conference !== team.conference
        );
        const gamesPerTeam = Math.floor(this.otherConferenceGames / otherTeams.length);
        
        for (const opponent of otherTeams) {
          const games = this.generateGamesForPair(
            team, opponent, gamesPerTeam, availableDates, schedule, 'interconference'
          );
          schedule.push(...games);
        }
      }

      // Save games in chunks
      for (let i = 0; i < schedule.length; i += CHUNK_SIZE) {
        const batch = writeBatch(this.firestore);
        const chunk = schedule.slice(i, i + CHUNK_SIZE);
        
        for (const game of chunk) {
          const teamARef = doc(collection(this.firestore, `teams/${game.teamAId}/games`));
          const teamBRef = doc(collection(this.firestore, `teams/${game.teamBId}/games`));
          
          batch.set(teamARef, { ...game, timestamp: new Date() });
          batch.set(teamBRef, { ...game, timestamp: new Date() });
        }
        
        await batch.commit();
      }

      this.allGames = schedule.sort((a, b) => a.date.localeCompare(b.date));
      this.filterGames();
      
      alert('Schedule generated successfully!');
      await this.loadAllGames();
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

  filterGames() {
    this.filteredGames = this.allGames.filter(game => {
      const matchesSeason = game.season === this.selectedSeason;
      const matchesTeam = this.viewMode === 'all' || !this.selectedTeamId || 
        game.teamAId === this.selectedTeamId || game.teamBId === this.selectedTeamId;
      const matchesTags = this.filterTags.length === 0 || 
        this.filterTags.some(tag => game.tags?.includes(tag));
      
      return matchesSeason && matchesTeam && matchesTags;
    });

    if (this.filteredGames.length > 0) {
      const dates = this.filteredGames.map(g => new Date(g.date));
      const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const endDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      this.seasonStartDate = startDate.toISOString().split('T')[0];
      this.seasonEndDate = endDate.toISOString().split('T')[0];
      this.currentMonth = startDate;
      this.generateCalendar();
    }
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