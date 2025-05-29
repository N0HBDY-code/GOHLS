import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  Firestore,
  collection,
  getDocs,
  addDoc,
  doc,
  query,
  where,
  deleteDoc,
  getDoc,
  setDoc,
  updateDoc,
  orderBy
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
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  week: number;
  day: string;
  season: number;
  tags: string[];
}

interface WeekSchedule {
  weekNumber: number;
  games: {
    [day: string]: Game[];
  };
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
  weeklySchedule: WeekSchedule[] = [];
  isClearing = false;
  currentSeason = 1;
  editingSeason = false;
  tempSeason = 1;
  selectedWeek = 1;
  loading = false;
  activeWeeks: number[] = [];
  gamesCache = new Map<string, Game>();

  newGame = {
    homeTeamId: '',
    awayTeamId: '',
    week: 1,
    day: '',
    season: 1,
    isRival: false
  };

  constructor(private firestore: Firestore, private router: Router) {}

  async ngOnInit() {
    await this.loadTeams();
    await this.loadCurrentSeason();
    await this.loadActiveWeeks();
    if (this.activeWeeks.length > 0) {
      this.selectedWeek = this.activeWeeks[0];
      await this.loadWeek(this.selectedWeek);
    }
  }

  formatDay(day: string | number): string {
    const dayStr = day.toString();
    // Remove 'D' prefix if it exists, then add it back
    const cleanDay = dayStr.startsWith('D') ? dayStr.substring(1) : dayStr;
    return `D${cleanDay}`;
  }

  async loadCurrentSeason() {
    const seasonDoc = doc(this.firestore, 'settings/season');
    const seasonSnap = await getDoc(seasonDoc);
    if (seasonSnap.exists()) {
      this.currentSeason = seasonSnap.data()['currentSeason'] || 1;
      this.newGame.season = this.currentSeason;
    }
  }

  async loadActiveWeeks() {
    const gamesQuery = query(
      collection(this.firestore, 'games'),
      where('season', '==', this.currentSeason),
      orderBy('week')
    );
    
    const snapshot = await getDocs(gamesQuery);
    const weeks = new Set<number>();
    snapshot.docs.forEach(doc => {
      weeks.add(doc.data()['week']);
    });
    
    this.activeWeeks = Array.from(weeks).sort((a, b) => a - b);
  }

  async saveSeason() {
    const seasonDoc = doc(this.firestore, 'settings/season');
    await setDoc(seasonDoc, { currentSeason: this.tempSeason });
    this.currentSeason = this.tempSeason;
    this.newGame.season = this.currentSeason;
    this.editingSeason = false;
    this.weeklySchedule = [];
    await this.loadActiveWeeks();
    if (this.activeWeeks.length > 0) {
      this.selectedWeek = this.activeWeeks[0];
      await this.loadWeek(this.selectedWeek);
    }
  }

  async loadTeams() {
    if (this.teams.length > 0) return;
    
    const snapshot = await getDocs(collection(this.firestore, 'teams'));
    this.teams = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['name'] || 'Unnamed',
      conference: doc.data()['conference'],
      division: doc.data()['division'],
      logoUrl: doc.data()['logoUrl']
    }));
  }

  async loadWeek(weekNumber: number) {
    if (this.loading) return;
    
    this.loading = true;
    try {
      const gamesQuery = query(
        collection(this.firestore, 'games'),
        where('season', '==', this.currentSeason),
        where('week', '==', weekNumber)
      );

      const snapshot = await getDocs(gamesQuery);
      const weekGames = await Promise.all(
        snapshot.docs.map(async doc => {
          const gameData = doc.data();
          const cacheKey = `${gameData['week']}-${gameData['day']}-${gameData['homeTeamId']}-${gameData['awayTeamId']}`;
          
          if (this.gamesCache.has(cacheKey)) {
            return this.gamesCache.get(cacheKey)!;
          }

          const homeTeam = this.teams.find(t => t.id === gameData['homeTeamId']);
          const awayTeam = this.teams.find(t => t.id === gameData['awayTeamId']);
          
          const game: Game = {
            id: doc.id,
            ...gameData,
            day: this.formatDay(gameData['day']),
            homeTeam: homeTeam?.name || 'Unknown Team',
            awayTeam: awayTeam?.name || 'Unknown Team',
            homeLogo: homeTeam?.logoUrl,
            awayLogo: awayTeam?.logoUrl,
            tags: gameData['tags'] || []
          } as Game;

          this.gamesCache.set(cacheKey, game);
          return game;
        })
      );

      this.updateWeekSchedule(weekGames, weekNumber);
    } finally {
      this.loading = false;
    }
  }

  private updateWeekSchedule(games: Game[], weekNumber: number) {
    const weekSchedule = this.weeklySchedule.find(w => w.weekNumber === weekNumber) || {
      weekNumber,
      games: {}
    };

    // Clear existing games for this week
    weekSchedule.games = {};

    games.forEach(game => {
      if (!weekSchedule.games[game.day]) {
        weekSchedule.games[game.day] = [];
      }
      weekSchedule.games[game.day].push(game);
    });

    // Sort games by day
    Object.keys(weekSchedule.games).forEach(day => {
      weekSchedule.games[day].sort((a, b) => {
        return a.day.localeCompare(b.day);
      });
    });

    const existingWeekIndex = this.weeklySchedule.findIndex(w => w.weekNumber === weekNumber);
    if (existingWeekIndex === -1) {
      this.weeklySchedule.push(weekSchedule);
    } else {
      this.weeklySchedule[existingWeekIndex] = weekSchedule;
    }
    
    this.weeklySchedule.sort((a, b) => a.weekNumber - b.weekNumber);
  }

  async onWeekChange(weekNumber: number) {
    this.selectedWeek = weekNumber;
    await this.loadWeek(weekNumber);
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
    if (this.newGame.isRival) {
      tags.push('rival');
    } else if (homeTeam.division === awayTeam.division) {
      tags.push('division');
    } else if (homeTeam.conference === awayTeam.conference) {
      tags.push('conference');
    }

    const gameData = {
      ...this.newGame,
      day: this.formatDay(this.newGame.day),
      season: this.currentSeason,
      tags
    };

    await addDoc(collection(this.firestore, 'games'), gameData);
    await addDoc(collection(this.firestore, `teams/${this.newGame.homeTeamId}/games`), gameData);
    await addDoc(collection(this.firestore, `teams/${this.newGame.awayTeamId}/games`), gameData);

    this.newGame = {
      homeTeamId: '',
      awayTeamId: '',
      week: this.newGame.week,
      day: '',
      season: this.currentSeason,
      isRival: false
    };

    await this.loadActiveWeeks();
    await this.loadWeek(this.selectedWeek);
  }

  async toggleRival(game: Game) {
    const tags = [...game.tags];
    const rivalIndex = tags.indexOf('rival');
    
    if (rivalIndex > -1) {
      tags.splice(rivalIndex, 1);
      if (game.homeTeamId && game.awayTeamId) {
        const homeTeam = this.teams.find(t => t.id === game.homeTeamId);
        const awayTeam = this.teams.find(t => t.id === game.awayTeamId);
        if (homeTeam?.division === awayTeam?.division) {
          tags.push('division');
        } else if (homeTeam?.conference === awayTeam?.conference) {
          tags.push('conference');
        }
      }
    } else {
      tags.length = 0;
      tags.push('rival');
    }

    const gameRef = doc(this.firestore, `games/${game.id}`);
    await updateDoc(gameRef, { tags });
    
    const cacheKey = `${game.week}-${game.day}-${game.homeTeamId}-${game.awayTeamId}`;
    if (this.gamesCache.has(cacheKey)) {
      const cachedGame = this.gamesCache.get(cacheKey)!;
      cachedGame.tags = tags;
      this.gamesCache.set(cacheKey, cachedGame);
    }

    await this.loadWeek(this.selectedWeek);
  }

  async clearAllGames() {
    if (!confirm('Are you sure you want to delete ALL games? This cannot be undone!')) {
      return;
    }

    this.isClearing = true;
    try {
      const gamesRef = collection(this.firestore, 'games');
      const snapshot = await getDocs(gamesRef);
      
      for (const doc of snapshot.docs) {
        await deleteDoc(doc.ref);
      }
      
      this.weeklySchedule = [];
      this.gamesCache.clear();
      this.activeWeeks = [];
      
      alert('All games have been cleared successfully!');
    } catch (error) {
      console.error('Error clearing games:', error);
      alert('Error clearing games. Please check the console for details.');
    } finally {
      this.isClearing = false;
    }
  }

  getWeekSchedule(weekNumber: number): WeekSchedule | undefined {
    return this.weeklySchedule.find(w => w.weekNumber === weekNumber);
  }

  getGamesForDay(weekSchedule: WeekSchedule, day: string): Game[] {
    return weekSchedule.games[day] || [];
  }

  getDays(weekSchedule: WeekSchedule): string[] {
    return Object.keys(weekSchedule.games).sort();
  }

  viewGame(game: Game) {
    this.router.navigate(['/games', game.homeTeamId, game.id]);
  }
}