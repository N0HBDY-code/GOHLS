import { Component, OnInit } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  doc,
  CollectionReference,
  DocumentData,
  setDoc,
  getDoc,
  updateDoc
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { saveAs } from 'file-saver';
import { AuthService } from '../auth.service';

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
  conference?: string;
  division?: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  overtimeLosses: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifferential: number;
  pointPercentage: number;
  playoffStatus?: 'league' | 'conference' | 'division' | 'playoff' | 'eliminated' | null;
}

interface Conference {
  name: string;
  divisions: string[];
}

interface CachedStandings {
  data: Map<string, StandingsTeam[]>;
  timestamp: number;
  league: 'major' | 'minor';
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
  
  // Standings data with caching
  selectedLeague: 'major' | 'minor' = 'major';
  standingsViewType: 'division' | 'conference' | 'overall' = 'division';
  standings: Map<string, StandingsTeam[]> = new Map();
  overallStandings: StandingsTeam[] = [];
  conferenceStandings: Map<string, StandingsTeam[]> = new Map();
  loadingStandings = false;
  
  // Cache management
  private standingsCache: Map<string, CachedStandings> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private teamsCache: Team[] = [];
  private teamsCacheTimestamp = 0;
  
  // Playoff management
  canManagePlayoffs = false;
  showPlayoffManager = false;
  playoffStatuses: Map<string, string> = new Map();
  
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

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    // Check permissions
    this.authService.effectiveRoles.subscribe(roles => {
      this.canManagePlayoffs = roles.some(role => 
        ['developer', 'commissioner'].includes(role)
      );
    });

    await this.loadTeams();
    await this.loadStandings();
    await this.loadPlayoffStatuses();
  }

  get conferences(): Conference[] {
    return this.selectedLeague === 'major' ? this.majorLeagueConferences : this.minorLeagueConferences;
  }

  // Add getter for filtered teams by league
  get filteredTeams(): Team[] {
    return this.teams.filter(t => (t.league || 'major') === this.selectedLeague);
  }

  private isCacheValid(cacheKey: string): boolean {
    const cached = this.standingsCache.get(cacheKey);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < this.CACHE_DURATION && cached.league === this.selectedLeague;
  }

  private async loadTeamsWithCache(): Promise<Team[]> {
    const now = Date.now();
    
    // Check if teams cache is still valid (cache for 10 minutes)
    if (this.teamsCache.length > 0 && (now - this.teamsCacheTimestamp) < (10 * 60 * 1000)) {
      return this.teamsCache;
    }

    // Load fresh teams data
    const teamsRef = collection(this.firestore, 'teams');
    const snapshot = await getDocs(teamsRef);
    
    this.teamsCache = snapshot.docs.map(doc => ({
      id: doc.id,
      name: (doc.data() as any).name || 'Unnamed',
      logoUrl: (doc.data() as any).logoUrl,
      conference: (doc.data() as any).conference,
      division: (doc.data() as any).division,
      league: (doc.data() as any).league || 'major'
    }));
    
    this.teamsCacheTimestamp = now;
    return this.teamsCache;
  }

  async loadTeams() {
    this.teams = await this.loadTeamsWithCache();
  }

  async loadPlayoffStatuses() {
    try {
      const statusRef = doc(this.firestore, `playoffStatuses/${this.selectedLeague}`);
      const statusSnap = await getDoc(statusRef);
      
      if (statusSnap.exists()) {
        const data = statusSnap.data();
        this.playoffStatuses = new Map(Object.entries(data));
      } else {
        this.playoffStatuses = new Map();
      }
    } catch (error) {
      console.error('Error loading playoff statuses:', error);
      this.playoffStatuses = new Map();
    }
  }

  async savePlayoffStatuses() {
    try {
      const statusRef = doc(this.firestore, `playoffStatuses/${this.selectedLeague}`);
      const statusData = Object.fromEntries(this.playoffStatuses);
      await setDoc(statusRef, statusData);
      
      // Clear cache to force reload with new playoff statuses
      this.standingsCache.clear();
      await this.loadStandings();
    } catch (error) {
      console.error('Error saving playoff statuses:', error);
    }
  }

  async updateTeamPlayoffStatus(teamId: string, status: string) {
    if (status === 'none') {
      this.playoffStatuses.delete(teamId);
    } else {
      this.playoffStatuses.set(teamId, status);
    }
    await this.savePlayoffStatuses();
  }

  getTeamPlayoffStatus(teamId: string): string {
    return this.playoffStatuses.get(teamId) || 'none';
  }

  getPlayoffStatusClass(team: StandingsTeam): string {
    const status = this.getTeamPlayoffStatus(team.id);
    switch (status) {
      case 'league': return 'table-warning';
      case 'conference': return 'table-info';
      case 'division': return 'table-primary';
      case 'playoff': return 'table-success';
      case 'eliminated': return 'table-danger';
      default: return '';
    }
  }

  getPlayoffStatusBadge(team: StandingsTeam): { text: string; class: string } | null {
    const status = this.getTeamPlayoffStatus(team.id);
    switch (status) {
      case 'league': return { text: 'P', class: 'badge bg-warning text-dark' };
      case 'conference': return { text: 'z', class: 'badge bg-info' };
      case 'division': return { text: 'y', class: 'badge bg-primary' };
      case 'playoff': return { text: 'x', class: 'badge bg-success' };
      case 'eliminated': return { text: 'e', class: 'badge bg-danger' };
      default: return null;
    }
  }

  async loadStandings() {
    const cacheKey = this.selectedLeague;
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.standingsCache.get(cacheKey)!;
      this.standings = cached.data;
      this.processStandingsViews();
      return;
    }

    this.loadingStandings = true;
    try {
      // Use cached teams data
      const allTeams = await this.loadTeamsWithCache();
      const leagueTeams = allTeams.filter(team => 
        (team.league || 'major') === this.selectedLeague
      );

      // Batch load all games for league teams in parallel
      const teamGamesPromises = leagueTeams.map(async (team) => {
        const gamesRef = collection(this.firestore, `teams/${team.id}/games`);
        const gamesSnapshot = await getDocs(gamesRef);
        return {
          team,
          games: gamesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        };
      });

      const teamGamesResults = await Promise.all(teamGamesPromises);
      
      // Process standings data efficiently
      const standingsData: StandingsTeam[] = teamGamesResults.map(({ team, games }) => {
        let wins = 0;
        let losses = 0;
        let overtimeLosses = 0;
        let goalsFor = 0;
        let goalsAgainst = 0;
        let gamesPlayed = 0;

        // Process games for this team
        games.forEach((gameData: any) => {
          // Only count games with scores
          if (gameData.homeScore !== undefined || gameData.awayScore !== undefined) {
            gamesPlayed++;
            
            const isHome = gameData.isHome || false;
            const teamScore = isHome ? (gameData.homeScore || 0) : (gameData.awayScore || 0);
            const opponentScore = isHome ? (gameData.awayScore || 0) : (gameData.homeScore || 0);
            
            goalsFor += teamScore;
            goalsAgainst += opponentScore;
            
            if (teamScore > opponentScore) {
              wins++;
            } else if (teamScore < opponentScore) {
              // Check if it was an overtime/shootout loss
              if (gameData.period === 'OT' || gameData.period === 'SO') {
                overtimeLosses++;
              } else {
                losses++;
              }
            }
          }
        });

        const points = (wins * 2) + overtimeLosses;
        const pointPercentage = gamesPlayed > 0 ? points / (gamesPlayed * 2) : 0;

        return {
          id: team.id,
          name: team.name,
          logoUrl: team.logoUrl,
          conference: team.conference,
          division: team.division,
          gamesPlayed,
          wins,
          losses,
          overtimeLosses,
          points,
          goalsFor,
          goalsAgainst,
          goalDifferential: goalsFor - goalsAgainst,
          pointPercentage,
          playoffStatus: this.getTeamPlayoffStatus(team.id) as any
        };
      });

      // Group by division and sort efficiently
      const newStandings = new Map<string, StandingsTeam[]>();
      
      for (const conference of this.conferences) {
        for (const division of conference.divisions) {
          const divisionTeams = standingsData
            .filter(team => {
              const teamData = allTeams.find(t => t.id === team.id);
              return teamData?.conference === conference.name && teamData?.division === division;
            })
            .sort((a, b) => {
              if (b.points !== a.points) return b.points - a.points;
              if (b.pointPercentage !== a.pointPercentage) return b.pointPercentage - a.pointPercentage;
              return b.goalDifferential - a.goalDifferential;
            });
          
          newStandings.set(`${conference.name}-${division}`, divisionTeams);
        }
      }

      this.standings = newStandings;
      this.processStandingsViews();

      // Cache the results
      this.standingsCache.set(cacheKey, {
        data: new Map(newStandings),
        timestamp: Date.now(),
        league: this.selectedLeague
      });

    } finally {
      this.loadingStandings = false;
    }
  }

  private processStandingsViews() {
    // Create overall standings (all teams sorted)
    const allTeams: StandingsTeam[] = [];
    this.standings.forEach(teams => allTeams.push(...teams));
    
    this.overallStandings = allTeams.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.pointPercentage !== a.pointPercentage) return b.pointPercentage - a.pointPercentage;
      return b.goalDifferential - a.goalDifferential;
    });

    // Create conference standings
    this.conferenceStandings.clear();
    
    for (const conference of this.conferences) {
      const conferenceTeams: StandingsTeam[] = [];
      
      for (const division of conference.divisions) {
        const divisionTeams = this.standings.get(`${conference.name}-${division}`) || [];
        conferenceTeams.push(...divisionTeams);
      }
      
      // Sort conference teams
      conferenceTeams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.pointPercentage !== a.pointPercentage) return b.pointPercentage - a.pointPercentage;
        return b.goalDifferential - a.goalDifferential;
      });
      
      this.conferenceStandings.set(conference.name, conferenceTeams);
    }
  }

  getStandingsForDivision(conference: string, division: string): StandingsTeam[] {
    return this.standings.get(`${conference}-${division}`) || [];
  }

  getStandingsForConference(conference: string): StandingsTeam[] {
    return this.conferenceStandings.get(conference) || [];
  }

  getOverallStandings(): StandingsTeam[] {
    return this.overallStandings;
  }

  onStandingsViewChange() {
    // View type changed, no need to reload data, just update display
  }

  async onLeagueChange() {
    await this.loadPlayoffStatuses();
    await this.loadStandings();
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

    // Batch load all stats for all games
    const statsPromises = games.map(async (game) => {
      const statsRef = collection(this.firestore, `teams/${this.selectedTeamId}/games/${game.id}/stats`);
      const statsSnapshot = await getDocs(statsRef);
      return statsSnapshot.docs.map(doc => doc.data());
    });

    const allGameStats = await Promise.all(statsPromises);
    
    // Process stats efficiently
    allGameStats.forEach(gameStats => {
      gameStats.forEach((stats: any) => {
        this.totalPoints += stats.points || 0;
        this.totalAssists += stats.assists || 0;
        this.totalRebounds += stats.rebounds || 0;
      });
    });
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

    // Batch load roster and stats
    const [rosterSnap, statsSnap] = await Promise.all([
      getDocs(collection(this.firestore, `teams/${this.selectedExportTeamId}/roster`)),
      getDocs(collection(this.firestore, `teams/${this.selectedExportTeamId}/games/${this.selectedExportGameId}/stats`))
    ]);

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

  // Force refresh standings (bypass cache)
  async refreshStandings() {
    const cacheKey = this.selectedLeague;
    this.standingsCache.delete(cacheKey);
    await this.loadStandings();
  }

  // Clear all caches
  clearCache() {
    this.standingsCache.clear();
    this.teamsCache = [];
    this.teamsCacheTimestamp = 0;
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