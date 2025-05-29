import { Component, OnInit } from '@angular/core';
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
  setDoc
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
  tags?: string[];
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
  games: Game[] = [];
  weeklySchedule: WeekSchedule[] = [];
  isClearing = false;
  currentSeason = 1;
  editingSeason = false;
  tempSeason = 1;
  selectedWeek = 1;
  uniqueDays: string[] = [];

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
    await this.loadCurrentSeason();
    await this.loadGames();
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
    await this.loadGames();
  }

  async loadTeams() {
    const snapshot = await getDocs(collection(this.firestore, 'teams'));
    this.teams = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['name'] || 'Unnamed',
      conference: doc.data()['conference'],
      division: doc.data()['division'],
      logoUrl: doc.data()['logoUrl']
    }));
  }

  async loadGames() {
    const allGames = new Map<string, Game>();
    
    for (const team of this.teams) {
      const gamesRef = collection(this.firestore, `teams/${team.id}/games`);
      const q = query(gamesRef, where('season', '==', this.currentSeason));
      const snapshot = await getDocs(q);
      
      snapshot.docs.forEach(doc => {
        const gameData = doc.data();
        const gameKey = `${gameData['week']}-${gameData['day']}-${gameData['homeTeamId']}-${gameData['awayTeamId']}`;
        
        if (!allGames.has(gameKey)) {
          const homeTeam = this.teams.find(t => t.id === gameData['homeTeamId']);
          const awayTeam = this.teams.find(t => t.id === gameData['awayTeamId']);
          
          allGames.set(gameKey, {
            id: doc.id,
            ...gameData,
            homeTeam: homeTeam?.name || 'Unknown Team',
            awayTeam: awayTeam?.name || 'Unknown Team',
            homeLogo: homeTeam?.logoUrl,
            awayLogo: awayTeam?.logoUrl
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

    this.uniqueDays = [...new Set(this.games.map(g => g.day))].sort();

    const weekMap = new Map<number, WeekSchedule>();
    
    this.games.forEach(game => {
      if (!weekMap.has(game.week)) {
        weekMap.set(game.week, {
          weekNumber: game.week,
          games: {}
        });
      }
      
      const weekSchedule = weekMap.get(game.week)!;
      if (!weekSchedule.games[game.day]) {
        weekSchedule.games[game.day] = [];
      }
      weekSchedule.games[game.day].push(game);
    });

    this.weeklySchedule = Array.from(weekMap.values())
      .sort((a, b) => a.weekNumber - b.weekNumber);

    if (this.weeklySchedule.length > 0) {
      this.selectedWeek = this.weeklySchedule[0].weekNumber;
    }
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
      season: this.currentSeason,
      tags
    };

    await addDoc(collection(this.firestore, `teams/${this.newGame.homeTeamId}/games`), gameData);
    await addDoc(collection(this.firestore, `teams/${this.newGame.awayTeamId}/games`), gameData);

    this.newGame = {
      homeTeamId: '',
      awayTeamId: '',
      week: this.newGame.week,
      day: '',
      season: this.currentSeason
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
      this.weeklySchedule = [];
      await this.loadGames();
      
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
}