import { Component, OnInit } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  doc,
  CollectionReference,
  DocumentData
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { saveAs } from 'file-saver';

interface Team {
  id: string;
  name: string;
  logoUrl?: string;
  conference?: string;
  division?: string;
  league?: string;
}

interface Game {
  id: string;
  [key: string]: any;
}

interface Player {
  id: string;
  name?: string;
  number?: number;
  position?: string;
}

interface StandingsTeam {
  id: string;
  name: string;
  logoUrl?: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  overtimeLosses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifferential: number;
  pointPercentage: number;
}

interface Conference {
  name: string;
  divisions: string[];
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css'
})
export class AnalyticsComponent implements OnInit {
  currentView: 'standings' | 'analytics' | 'reports' = 'standings';
  
  // Standings data
  selectedLeague: 'major' | 'minor' = 'major';
  standings: Map<string, StandingsTeam[]> = new Map();
  loadingStandings = false;
  
  // Conference structures
  majorLeagueConferences: Conference[] = [
    {
      name: 'Mr. Hockey Conference',
      divisions: ['Europe Division', 'Great Lakes Division', 'Atlantic Division']
    },
    {
      name: 'The Rocket Conference',
      divisions: ['Northwest Division', 'Pacific Division', 'South Division']
    }
  ];

  minorLeagueConferences: Conference[] = [
    {
      name: 'Development Conference',
      divisions: ['Eastern Development', 'Western Development', 'Central Development']
    },
    {
      name: 'Prospect Conference',
      divisions: ['Northern Prospects', 'Southern Prospects', 'Coastal Prospects']
    }
  ];

  // Analytics data
  teams: Team[] = [];
  selectedTeamId = '';
  totalGames = 0;
  totalPoints = 0;
  totalAssists = 0;
  totalRebounds = 0;

  // Export data
  exportGames: Game[] = [];
  selectedExportTeamId = '';
  selectedExportGameId = '';

  constructor(private firestore: Firestore) {}

  async ngOnInit() {
    await this.loadTeams();
    await this.loadStandings();
  }

  get conferences(): Conference[] {
    return this.selectedLeague === 'major' ? this.majorLeagueConferences : this.minorLeagueConferences;
  }

  async loadTeams() {
    const teamsRef = collection(this.firestore, 'teams');
    const snapshot = await getDocs(teamsRef);
    this.teams = snapshot.docs.map(doc => ({
      id: doc.id,
      name: (doc.data() as any).name || 'Unnamed',
      logoUrl: (doc.data() as any).logoUrl,
      conference: (doc.data() as any).conference,
      division: (doc.data() as any).division,
      league: (doc.data() as any).league || 'major'
    }));
  }

  async loadStandings() {
    this.loadingStandings = true;
    try {
      const leagueTeams = this.teams.filter(team => 
        (team.league || 'major') === this.selectedLeague
      );

      const standingsData: StandingsTeam[] = [];

      for (const team of leagueTeams) {
        const gamesRef = collection(this.firestore, `teams/${team.id}/games`);
        const gamesSnapshot = await getDocs(gamesRef);
        
        let wins = 0;
        let losses = 0;
        let overtimeLosses = 0;
        let goalsFor = 0;
        let goalsAgainst = 0;
        let gamesPlayed = 0;

        for (const gameDoc of gamesSnapshot.docs) {
          const gameData = gameDoc.data();
          
          // Only count games with scores
          if (gameData['homeScore'] !== undefined || gameData['awayScore'] !== undefined) {
            gamesPlayed++;
            
            const isHome = gameData['isHome'] || false;
            const teamScore = isHome ? (gameData['homeScore'] || 0) : (gameData['awayScore'] || 0);
            const opponentScore = isHome ? (gameData['awayScore'] || 0) : (gameData['homeScore'] || 0);
            
            goalsFor += teamScore;
            goalsAgainst += opponentScore;
            
            if (teamScore > opponentScore) {
              wins++;
            } else if (teamScore < opponentScore) {
              // Check if it was an overtime/shootout loss (could be determined by period)
              if (gameData['period'] === 'OT' || gameData['period'] === 'SO') {
                overtimeLosses++;
              } else {
                losses++;
              }
            }
          }
        }

        const points = (wins * 2) + overtimeLosses;
        const pointPercentage = gamesPlayed > 0 ? points / (gamesPlayed * 2) : 0;

        standingsData.push({
          id: team.id,
          name: team.name,
          logoUrl: team.logoUrl,
          gamesPlayed,
          wins,
          losses,
          overtimeLosses,
          points,
          goalsFor,
          goalsAgainst,
          goalDifferential: goalsFor - goalsAgainst,
          pointPercentage
        });
      }

      // Group by division and sort by points
      this.standings.clear();
      
      for (const conference of this.conferences) {
        for (const division of conference.divisions) {
          const divisionTeams = standingsData
            .filter(team => {
              const teamData = this.teams.find(t => t.id === team.id);
              return teamData?.conference === conference.name && teamData?.division === division;
            })
            .sort((a, b) => {
              if (b.points !== a.points) return b.points - a.points;
              if (b.pointPercentage !== a.pointPercentage) return b.pointPercentage - a.pointPercentage;
              return b.goalDifferential - a.goalDifferential;
            });
          
          this.standings.set(`${conference.name}-${division}`, divisionTeams);
        }
      }
    } finally {
      this.loadingStandings = false;
    }
  }

  getStandingsForDivision(conference: string, division: string): StandingsTeam[] {
    return this.standings.get(`${conference}-${division}`) || [];
  }

  async onTeamSelect() {
    if (!this.selectedTeamId) return;

    this.totalGames = 0;
    this.totalPoints = 0;
    this.totalAssists = 0;
    this.totalRebounds = 0;

    const gamesRef = collection(this.firestore, `teams/${this.selectedTeamId}/games`);
    const gamesSnapshot = await getDocs(gamesRef);
    const games = gamesSnapshot.docs.map(doc => ({
      id: doc.id,
      date: (doc.data() as any).date
    })) as Game[];

    this.totalGames = games.length;

    for (const game of games) {
      const statsRef = collection(this.firestore, `teams/${this.selectedTeamId}/games/${game.id}/stats`);
      const statsSnapshot = await getDocs(statsRef);

      for (const statDoc of statsSnapshot.docs) {
        const stats = statDoc.data() as any;
        this.totalPoints += stats.points || 0;
        this.totalAssists += stats.assists || 0;
        this.totalRebounds += stats.rebounds || 0;
      }
    }
  }

  async onExportTeamSelect() {
    if (!this.selectedExportTeamId) return;
    const gamesRef = collection(this.firestore, `teams/${this.selectedExportTeamId}/games`) as CollectionReference<DocumentData>;
    const snapshot = await getDocs(gamesRef);
    this.exportGames = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async exportSelectedGameToCSV() {
    if (!this.selectedExportTeamId || !this.selectedExportGameId) return;

    const team = this.teams.find(t => t.id === this.selectedExportTeamId);
    const game = this.exportGames.find(g => g.id === this.selectedExportGameId);
    if (!game) return;

    const rosterSnap = await getDocs(collection(this.firestore, `teams/${this.selectedExportTeamId}/roster`));
    const statsSnap = await getDocs(collection(this.firestore, `teams/${this.selectedExportTeamId}/games/${this.selectedExportGameId}/stats`));

    const roster = rosterSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const statsMap = Object.fromEntries(statsSnap.docs.map(doc => [doc.id, doc.data()]));

    const headers = ["Team", "Game Date", "Opponent", "Player Name", "Number", "Position", "Points", "Assists", "Rebounds", "Score"];
    const rows: string[] = [];

    let totalPoints = 0;
    for (const player of roster) {
      const stats = statsMap[player.id] || { points: 0, assists: 0, rebounds: 0 };
      totalPoints += stats["points"];

      const dateStr = game["date"]?.toDate?.() ? game["date"].toDate().toISOString().split("T")[0] : game["date"];
      const row = [
        team?.name || "",
        dateStr,
        game["opponent"] || "",
        (player as any)["name"],
        (player as any)["number"],
        (player as any)["position"],
        stats["points"],
        stats["assists"],
        stats["rebounds"],
        ""  // placeholder for score
      ];
      rows.push(row.map(val => `"${val}"`).join(","));
    }

    const score = `${totalPoints}-??`;
    const finalRows = rows.map(r => r.replace(/,""$/, `,"${score}"`));
    const csv = [headers.join(","), ...finalRows].join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `game_${this.selectedExportGameId}_players.csv`);
  }

  get avgPoints(): number {
    return this.totalGames ? Math.round(this.totalPoints / this.totalGames) : 0;
  }

  get avgAssists(): number {
    return this.totalGames ? Math.round(this.totalAssists / this.totalGames) : 0;
  }

  get avgRebounds(): number {
    return this.totalGames ? Math.round(this.totalRebounds / this.totalGames) : 0;
  }

  get selectedTeamName(): string {
    const team = this.teams.find(t => t.id === this.selectedTeamId);
    return team ? team.name : '';
  }
}