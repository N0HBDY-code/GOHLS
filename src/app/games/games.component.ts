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
  orderBy,
  limit
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
  loadedWeeks = new Set<number>();
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
    await this.loadWeek(this.selectedWeek);
  }

  formatDay(day: string | number): string {
    const dayStr = day.toString();
    return dayStr.startsWith('D') ? dayStr : `D${dayStr}`;
  }

  async loadCurrentSeason() {
    const seasonDoc = doc(this.firestore, 'settings/season');
    const seasonSnap = await getDoc(seasonDoc);
    if (seasonSnap.exists()) {
      this.currentSeason = seasonSnap.data()['currentSeason'] || 1;
      this.newGame.season = this.currentSeason;
    }
  }

  async saveSeason() {
    const seasonDoc = doc(this.firestore, 'settings/season');
    await setDoc(seasonDoc, { currentSeason: this.tempSeason });
    this.currentSeason = this.tempSeason;
    this.newGame.season = this.currentSeason;
    this.editingSeason = false;
    this.loadedWeeks.clear();
    this.weeklySchedule = [];
    await this.loadWeek(this.selectedWeek);
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
    if (this.loading || this.loadedWeeks.has(weekNumber)) return;
    
    this.loading = true;
    try {
      const gamesQuery = query(
        collection(this.firestore, 'games'),
        where('season', '==', this.currentSeason),
        where('week', '==', weekNumber),
        orderBy('day')
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
      this.loadedWeeks.add(weekNumber);

      // Preload next week
      if (weekNumber < 52) {
        this.preloadWeek(weekNumber + 1);
      }
    } finally {
      this.loading = false;
    }
  }

  private async preloadWeek(weekNumber: number) {
    if (this.loadedWeeks.has(weekNumber)) return;

    const gamesQuery = query(
      collection(this.firestore, 'games'),
      where('season', '==', this.currentSeason),
      where('week', '==', weekNumber),
      orderBy('day')
    );

    getDocs(gamesQuery).then(snapshot => {
      const weekGames = snapshot.docs.map(doc => {
        const gameData = doc.data();
        const homeTeam = this.teams.find(t => t.id === gameData['homeTeamId']);
        const awayTeam = this.teams.find(t => t.id === gameData['awayTeamId']);
        
        return {
          id: doc.id,
          ...gameData,
          day: this.formatDay(gameData['day']),
          homeTeam: homeTeam?.name || 'Unknown Team',
          awayTeam: awayTeam?.name || 'Unknown Team',
          homeLogo: homeTeam?.logoUrl,
          awayLogo: awayTeam?.logoUrl,
          tags: gameData['tags'] || []
        } as Game;
      });

      this.updateWeekSchedule(weekGames, weekNumber);
      this.loadedWeeks.add(weekNumber);
    });
  }

  private updateWeekSchedule(games: Game[], weekNumber: number) {
    const weekSchedule = this.weeklySchedule.find(w => w.weekNumber === weekNumber) || {
      weekNumber,
      games: {}
    };

    games.forEach(game => {
      if (!weekSchedule.games[game.day]) {
        weekSchedule.games[game.day] = [];
      }
      weekSchedule.games[game.day].push(game);
    });

    if (!this.weeklySchedule.some(w => w.weekNumber === weekNumber)) {
      this.weeklySchedule.push(weekSchedule);
      this.weeklySchedule.sort((a, b) => a.weekNumber - b.weekNumber);
    }
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

    // Reload the current week
    this.loadedWeeks.delete(this.selectedWeek);
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
    
    // Update cache and UI
    const cacheKey = `${game.week}-${game.day}-${game.homeTeamId}-${game.awayTeamId}`;
    if (this.gamesCache.has(cacheKey)) {
      const cachedGame = this.gamesCache.get(cacheKey)!;
      cachedGame.tags = tags;
      this.gamesCache.set(cacheKey, cachedGame);
    }

    // Reload the current week
    this.loadedWeeks.delete(this.selectedWeek);
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
      this.loadedWeeks.clear();
      
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