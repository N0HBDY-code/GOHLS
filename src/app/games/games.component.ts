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

// ... (keep all interfaces)

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './games.component.html',
  styleUrls: ['./games.component.css']
})
export class GamesComponent implements OnInit {
  // ... (keep all properties)

  formatDay(day: string | number): string {
    if (typeof day === 'string' && day.startsWith('D')) {
      return day;
    }
    return `D${day}`;
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

  // ... (keep all other methods)
}