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

  weeks = 10;
  daysPerWeek = 3;
  gamesPerDay = 3;
  intraDivGames = 2;
  intraConfGames = 1;
  interConfGames = 1;

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

  async generateSchedule() {
    const schedule: Game[] = [];
    const allDates: string[] = [];
    const today = new Date();

    for (let w = 0; w < this.weeks; w++) {
      for (let d = 0; d < this.daysPerWeek; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() + (w * 7) + d);
        allDates.push(date.toISOString().split('T')[0]);
      }
    }

    const matchups = new Set<string>();
    const getKey = (a: string, b: string) => [a, b].sort().join('-');
    const getRandomDate = (): string => {
      let attempts = 0;
      while (attempts++ < 100) {
        const date = allDates[Math.floor(Math.random() * allDates.length)];
        const count = schedule.filter(g => g.date === date).length;
        if (count < this.gamesPerDay) return date;
      }
      return allDates[0];
    };

    const canPlay = (team: string, date: string) => {
      return !schedule.some(g => (g.homeTeam === team || g.awayTeam === team) && g.date === date);
    };

    const attemptSchedule = (groupA: Team[], groupB: Team[], gamesPer: number, isCross = false) => {
      for (const teamA of groupA) {
        const pool = isCross ? groupB : groupB.filter(t => t.id !== teamA.id);
        for (const teamB of pool) {
          const key = getKey(teamA.id, teamB.id);
          if (matchups.has(key)) continue;

          for (let i = 0; i < gamesPer; i++) {
            const date = getRandomDate();
            if (canPlay(teamA.name, date) && canPlay(teamB.name, date)) {
              const home = Math.random() < 0.5 ? teamA : teamB;
              const away = home.id === teamA.id ? teamB : teamA;
              schedule.push({
                teamAId: teamA.id,
                teamBId: teamB.id,
                date,
                homeTeam: home.name,
                awayTeam: away.name,
                homeLogo: home.logoUrl,
                awayLogo: away.logoUrl,
                tags: teamA.division === teamB.division && teamA.conference === teamB.conference ? ['rivalry'] : []
              });
            }
          }
          matchups.add(key);
        }
      }
    };

    const conferences = [...new Set(this.teams.map(t => t.conference))];

    for (const conf of conferences) {
      const confTeams = this.teams.filter(t => t.conference === conf);
      const divisions = [...new Set(confTeams.map(t => t.division))];
      for (const div of divisions) {
        const divTeams = confTeams.filter(t => t.division === div);
        attemptSchedule(divTeams, divTeams, this.intraDivGames);
      }
      for (let i = 0; i < divisions.length; i++) {
        for (let j = i + 1; j < divisions.length; j++) {
          const divA = confTeams.filter(t => t.division === divisions[i]);
          const divB = confTeams.filter(t => t.division === divisions[j]);
          attemptSchedule(divA, divB, this.intraConfGames);
        }
      }
    }

    for (let i = 0; i < conferences.length; i++) {
      for (let j = i + 1; j < conferences.length; j++) {
        const confA = this.teams.filter(t => t.conference === conferences[i]);
        const confB = this.teams.filter(t => t.conference === conferences[j]);
        attemptSchedule(confA, confB, this.interConfGames, true);
      }
    }

    this.schedule = schedule.sort((a, b) => a.date.localeCompare(b.date));
  }
}
