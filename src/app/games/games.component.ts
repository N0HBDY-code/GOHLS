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
}

interface Game {
  id?: string;
  opponent: string;
  date: string;
}

interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
}

interface PlayerStats {
  points: number;
  assists: number;
  rebounds: number;
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
  selectedTeamId = '';
  games: Game[] = [];
  selectedGameId: string | null = null;

  opponent = '';
  date = '';

  players: Player[] = [];
  playerStatsMap: Record<string, PlayerStats> = {};

  score = '';

  constructor(private firestore: Firestore) {}

  async ngOnInit() {
    await this.loadTeams();
  }

  async loadTeams() {
    const teamsRef = collection(this.firestore, 'teams');
    const snapshot = await getDocs(teamsRef);
    this.teams = snapshot.docs.map(doc => ({
      id: doc.id,
      name: (doc.data() as any).name || 'Unnamed'
    }));
  }

  async onTeamSelect() {
    if (!this.selectedTeamId) return;
    await this.loadGames();
    await this.loadRoster();
  }

  async loadGames() {
    const gamesRef = collection(this.firestore, `teams/${this.selectedTeamId}/games`);
    const snapshot = await getDocs(gamesRef);
    this.games = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Game[];
  }

  async loadRoster() {
    const rosterRef = collection(this.firestore, `teams/${this.selectedTeamId}/roster`);
    const snapshot = await getDocs(rosterRef);
    this.players = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Player[];
  }

  async createGame() {
    if (!this.opponent || !this.date || !this.selectedTeamId) {
      alert('Missing team or inputs');
      return;
    }

    const gameData = {
      opponent: this.opponent,
      date: new Date(this.date),
      location: 'TBD',
      score: '',
      teamId: this.selectedTeamId
    };

    const teamGamesRef = collection(this.firestore, `teams/${this.selectedTeamId}/games`);
    await addDoc(teamGamesRef, gameData);

    const globalGamesRef = collection(this.firestore, 'games');
    await addDoc(globalGamesRef, gameData);

    this.opponent = '';
    this.date = '';
    await this.loadGames();
  }

  async selectGame(gameId: string) {
    if (this.selectedGameId === gameId) {
      this.selectedGameId = null;
      return;
    }

    this.selectedGameId = gameId;
    this.playerStatsMap = {};

    for (const player of this.players) {
      const statDoc = doc(this.firestore, `teams/${this.selectedTeamId}/games/${gameId}/stats/${player.id}`);
      const snap = await getDoc(statDoc);
      this.playerStatsMap[player.id] = snap.exists()
        ? (snap.data() as PlayerStats)
        : { points: 0, assists: 0, rebounds: 0 };
    }
  }

  async saveStats(playerId: string) {
    if (!this.selectedGameId || !this.selectedTeamId) return;

    const stats = this.playerStatsMap[playerId];
    const statDoc = doc(this.firestore, `teams/${this.selectedTeamId}/games/${this.selectedGameId}/stats/${playerId}`);
    await setDoc(statDoc, stats);

    let teamScore = 0;
    for (const stat of Object.values(this.playerStatsMap)) {
      teamScore += stat.points;
    }

    const opponentScore = 32;
    this.score = `${teamScore}-${opponentScore}`;

    const teamGameDoc = doc(this.firestore, `teams/${this.selectedTeamId}/games/${this.selectedGameId}`);
    await setDoc(teamGameDoc, { score: this.score }, { merge: true });

    const globalGamesRef = collection(this.firestore, 'games');
    const snapshot = await getDocs(globalGamesRef);
    const matching = snapshot.docs.find(doc =>
      doc.data()['teamId'] === this.selectedTeamId &&
      doc.data()['date']?.toDate?.().toDateString?.() === new Date(this.date).toDateString()
    );

    if (matching) {
      await setDoc(matching.ref, { score: this.score }, { merge: true });
    }
  }

  async deleteGame(gameId: string) {
    const confirmDelete = confirm('Are you sure you want to delete this game and its stats?');
    if (!confirmDelete || !this.selectedTeamId) return;

    const statsRef = collection(this.firestore, `teams/${this.selectedTeamId}/games/${gameId}/stats`);
    const statDocs = await getDocs(statsRef);
    for (const statDocSnap of statDocs.docs) {
      await deleteDoc(statDocSnap.ref);
    }

    const gameDoc = doc(this.firestore, `teams/${this.selectedTeamId}/games/${gameId}`);
    await deleteDoc(gameDoc);

    if (this.selectedGameId === gameId) this.selectedGameId = null;
    await this.loadGames();
  }
}