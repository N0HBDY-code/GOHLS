import { Component, OnInit } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  addDoc,
  doc,
  setDoc,
  getDoc,
  deleteDoc
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
}

interface CalendarDay {
  date: Date;
  games: Game[];
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
  opponent: string = '';
  date: string = '';

  // Schedule Generation Parameters
  seasonStartDate: Date = new Date();
  seasonEndDate: Date = new Date();
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
    this.schedule = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
    this.generateCalendar();
  }

  async createGame() {
    if (!this.selectedTeamId || !this.opponent || !this.date) {
      alert('Please fill in all required fields');
      return;
    }

    const gameData = {
      opponent: this.opponent,
      date: this.date,
      createdAt: new Date()
    };

    const gamesRef = collection(this.firestore, `teams/${this.selectedTeamId}/games`);
    await addDoc(gamesRef, gameData);

    this.opponent = '';
    this.date = '';
    await this.onTeamSelect();
  }

  generateCalendar() {
    this.calendarDays = [];
    if (this.schedule.length === 0) return;

    const startDate = new Date(this.seasonStartDate);
    const endDate = new Date(this.seasonEndDate);

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayGames = this.schedule.filter(game => {
        const gameDate = new Date(game.date);
        return gameDate.toDateString() === d.toDateString();
      });

      this.calendarDays.push({
        date: new Date(d),
        games: dayGames
      });
    }
  }

  isGameDay(date: Date): boolean {
    return this.gameDays[date.getDay()];
  }

  async generateSchedule() {
    if (!this.validateScheduleParams()) return;

    const schedule: Game[] = [];
    const availableDates: Date[] = [];
    
    // Generate available dates based on selected game days
    for (let d = new Date(this.seasonStartDate); d <= this.seasonEndDate; d.setDate(d.getDate() + 1)) {
      if (this.gameDays[d.getDay()]) {
        availableDates.push(new Date(d));
      }
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
            tags: teamA.division === teamB.division ? ['division'] :
                  teamA.conference === teamB.conference ? ['conference'] : ['interconference']
          });
        }
      }
      matchups.add(key);
    };

    // Schedule division games
    const divisionTeams = this.teams.filter(t => t.division === this.teams[0].division);
    for (let i = 0; i < divisionTeams.length; i++) {
      for (let j = i + 1; j < divisionTeams.length; j++) {
        scheduleGames(divisionTeams[i], divisionTeams[j], 
          Math.floor(this.divisionGames / (divisionTeams.length * (divisionTeams.length - 1) / 2)));
      }
    }

    // Schedule conference games
    const conferenceTeams = this.teams.filter(t => 
      t.conference === this.teams[0].conference && t.division !== this.teams[0].division);
    for (const teamA of divisionTeams) {
      for (const teamB of conferenceTeams) {
        scheduleGames(teamA, teamB,
          Math.floor(this.conferenceGames / (divisionTeams.length * conferenceTeams.length)));
      }
    }

    // Schedule other conference games
    const otherConfTeams = this.teams.filter(t => t.conference !== this.teams[0].conference);
    for (const teamA of divisionTeams) {
      for (const teamB of otherConfTeams) {
        scheduleGames(teamA, teamB,
          Math.floor(this.otherConferenceGames / (divisionTeams.length * otherConfTeams.length)));
      }
    }

    this.schedule = schedule.sort((a, b) => a.date.localeCompare(b.date));
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