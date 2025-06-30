import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  Firestore, 
  collection, 
  getDocs, 
  doc as firestoreDoc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc, 
  updateDoc, 
  writeBatch, 
  setDoc
} from '@angular/fire/firestore';
import { AuthService } from '../auth.service';

interface DraftClass {
  season: number;
  players: DraftPlayer[];
  status: 'upcoming' | 'active' | 'completed';
  startDate?: Date;
  endDate?: Date;
  league?: 'major' | 'minor';
}

interface DraftPlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  archetype: string;
  age: number;
  overall: number;
  draftRank?: number;
  draftedBy?: string;
  draftedTeamName?: string;
  draftedTeamLogo?: string;
  draftRound?: number;
  draftPick?: number;
  draftSeason?: number;
  teamId?: string;
  teamName?: string;
  teamLogo?: string;
}

interface DraftPick {
  id?: string;
  season: number;
  round: number;
  pick: number;
  teamId: string;
  teamName: string;
  originalTeamId?: string;
  originalTeamName?: string;
  playerId?: string;
  playerName?: string;
  completed: boolean;
}

interface Team {
  id: string;
  name: string;
  city: string;
  mascot: string;
  logoUrl?: string;
  conference: string;
  division: string;
  league?: string;
  points?: number;
  wins?: number;
  losses?: number;
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

@Component({
  selector: 'app-draft',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './draft.component.html',
  styleUrls: ['./draft.component.css']
})
export class DraftComponent implements OnInit {
  // Current view
  currentView: 'classes' | 'current' | 'history' = 'classes';
  
  // Draft classes
  draftClasses: DraftClass[] = [];
  selectedDraftClass: DraftClass | null = null;
  
  // Current draft
  currentDraftSeason = new Date().getFullYear();
  draftOrder: Team[] = [];
  draftPicks: DraftPick[] = [];
  currentRound = 1;
  currentPick = 1;
  draftInProgress = false;
  
  // Draft history
  draftHistory: DraftPick[] = [];
  
  // Teams
  teams: Team[] = [];
  
  // Permissions
  canManageDraft = false;
  isDeveloper = false;
  
  // Loading states
  loadingClasses = false;
  loadingDraft = false;
  loadingHistory = false;
  
  // Draft class management
  showCreateClassModal = false;
  newDraftClassSeason = new Date().getFullYear();
  newDraftClassLeague: 'major' | 'minor' = 'major';
  
  // Draft creation
  showCreateDraftModal = false;
  newDraftSeason = new Date().getFullYear();
  newDraftLeague: 'major' | 'minor' = 'major';
  newDraftRounds = 7;
  
  // Draft pick management
  showMakePickModal = false;
  selectedDraftPick: DraftPick | null = null;
  availablePlayers: DraftPlayer[] = [];
  selectedPlayerId = '';
  
  // Filters
  positionFilter: string = 'all';
  ageFilter: string = 'all';
  sortBy: 'overall' | 'age' | 'position' = 'overall';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Error states
  indexError = false;
  indexErrorMessage = '';

  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    // Check permissions
    this.authService.effectiveRoles.subscribe(roles => {
      this.canManageDraft = roles.some(role => 
        ['developer', 'commissioner'].includes(role)
      );
      this.isDeveloper = roles.includes('developer');
    });
    
    // Load teams
    await this.loadTeams();
    
    // Load draft classes
    await this.loadDraftClasses();
    
    // Load current draft
    await this.loadCurrentDraft();
    
    // Load draft history
    await this.loadDraftHistory();
  }
  
  async loadTeams() {
    try {
      const teamsRef = collection(this.firestore, 'teams');
      const snapshot = await getDocs(teamsRef);
      
      this.teams = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          name: `${data['city']} ${data['mascot']}`,
          city: data['city'],
          mascot: data['mascot'],
          logoUrl: data['logoUrl'],
          conference: data['conference'],
          division: data['division'],
          league: data['league'] || 'major'
        };
      });
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  }
  
  async loadDraftClasses() {
    this.loadingClasses = true;
    this.indexError = false;
    
    try {
      // Get current league season
      const seasonRef = firestoreDoc(this.firestore, 'leagueSettings/season');
      const seasonSnap = await getDoc(seasonRef);
      const currentSeason = seasonSnap.exists() ? (seasonSnap.data() as any)['currentSeason'] : 1;
      
      // Load draft classes from Firestore
      const classesRef = collection(this.firestore, 'draftClasses');
      const snapshot = await getDocs(classesRef);
      
      if (snapshot.empty && this.canManageDraft) {
        // Create initial draft class if none exist
        await this.createInitialDraftClass(currentSeason);
        // Reload after creation
        await this.loadDraftClasses();
        return;
      }
      
      // Process draft classes
      this.draftClasses = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data() as any;
        
        try {
          // Load players for this draft class - without orderBy to avoid index issues
          const playersQuery = query(
            collection(this.firestore, 'players'),
            where('draftClass', '==', data['season'])
          );
          
          const playersSnapshot = await getDocs(playersQuery);
          const players = await Promise.all(playersSnapshot.docs.map(async playerDoc => {
            const playerData = playerDoc.data() as any;
            
            // Get overall rating from attributes
            let overall = 50;
            try {
              const attributesRef = firestoreDoc(this.firestore, `players/${playerDoc.id}/meta/attributes`);
              const attributesSnap = await getDoc(attributesRef);
              if (attributesSnap.exists()) {
                const attrData = attributesSnap.data() as any;
                overall = attrData['OVERALL'] || 50;
              }
            } catch (error) {
              console.error('Error loading player attributes:', error);
            }
            
            // Get team information (either drafted team or current team)
            let teamId = playerData['teamId'];
            let teamName = undefined;
            let teamLogo = undefined;
            let draftedTeamName = undefined;
            let draftedTeamLogo = undefined;
            
            // Check if player has been drafted
            if (playerData['draftedBy']) {
              const draftedTeamRef = firestoreDoc(this.firestore, `teams/${playerData['draftedBy']}`);
              const draftedTeamSnap = await getDoc(draftedTeamRef);
              if (draftedTeamSnap.exists()) {
                const teamData = draftedTeamSnap.data() as any;
                draftedTeamName = `${teamData['city']} ${teamData['mascot']}`;
                draftedTeamLogo = teamData['logoUrl'] || '';
              }
            }
            
            // Check current team (might be different from drafted team)
            if (teamId && teamId !== 'none') {
              const teamRef = firestoreDoc(this.firestore, `teams/${teamId}`);
              const teamSnap = await getDoc(teamRef);
              if (teamSnap.exists()) {
                const teamData = teamSnap.data() as any;
                teamName = `${teamData['city']} ${teamData['mascot']}`;
                teamLogo = teamData['logoUrl'] || '';
              }
            }
            
            return {
              id: playerDoc.id,
              firstName: playerData['firstName'] || '',
              lastName: playerData['lastName'] || '',
              position: playerData['position'] || '',
              archetype: playerData['archetype'] || '',
              age: playerData['age'] || 19,
              overall,
              draftRank: playerData['draftRank'],
              draftedBy: playerData['draftedBy'],
              draftedTeamName,
              draftedTeamLogo,
              draftRound: playerData['draftRound'],
              draftPick: playerData['draftPick'],
              draftSeason: playerData['draftSeason'],
              teamId,
              teamName,
              teamLogo
            };
          }));
          
          // Sort players manually since we can't use orderBy
          players.sort((a, b) => {
            if (a.draftRank && b.draftRank) {
              return a.draftRank - b.draftRank;
            }
            return 0;
          });
          
          this.draftClasses.push({
            season: data['season'],
            players,
            status: data['status'] || 'upcoming',
            startDate: data['startDate'],
            endDate: data['endDate'],
            league: data['league'] || 'major'
          });
        } catch (error: any) {
          console.error(`Error loading players for draft class ${data['season']}:`, error);
          
          // Check if it's an index error
          if (error.message && error.message.includes('requires an index')) {
            this.indexError = true;
            this.indexErrorMessage = error.message;
            
            // Add an empty players array so the draft class still shows up
            this.draftClasses.push({
              season: data['season'],
              players: [],
              status: data['status'] || 'upcoming',
              startDate: data['startDate'],
              endDate: data['endDate'],
              league: data['league'] || 'major'
            });
          }
        }
      }
      
      // Sort draft classes by season (newest first)
      this.draftClasses.sort((a, b) => b.season - a.season);
      
      // Set selected draft class to the most recent one
      if (this.draftClasses.length > 0) {
        this.selectedDraftClass = this.draftClasses[0];
      }
    } catch (error: any) {
      console.error('Error loading draft classes:', error);
      
      // Check if it's an index error
      if (error.message && error.message.includes('requires an index')) {
        this.indexError = true;
        this.indexErrorMessage = error.message;
      }
    } finally {
      this.loadingClasses = false;
    }
  }
  
  async createInitialDraftClass(season: number) {
    try {
      // Create draft class document
      await addDoc(collection(this.firestore, 'draftClasses'), {
        season,
        status: 'upcoming',
        createdAt: new Date(),
        league: 'major'
      });
      
      console.log(`Created initial draft class for season ${season}`);
    } catch (error) {
      console.error('Error creating initial draft class:', error);
    }
  }
  
  async loadCurrentDraft() {
    this.loadingDraft = true;
    
    try {
      // Get current league season
      const seasonRef = firestoreDoc(this.firestore, 'leagueSettings/season');
      const seasonSnap = await getDoc(seasonRef);
      this.currentDraftSeason = seasonSnap.exists() ? (seasonSnap.data() as any)['currentSeason'] : 1;
      
      // Load draft order
      const orderRef = firestoreDoc(this.firestore, `drafts/${this.currentDraftSeason}/settings/order`);
      const orderSnap = await getDoc(orderRef);
      
      if (orderSnap.exists()) {
        const orderData = orderSnap.data() as any;
        this.draftOrder = await Promise.all((orderData['teams'] || []).map(async (teamId: string) => {
          const team = this.teams.find(t => t.id === teamId);
          if (team) return team;
          
          // If team not found in cache, load it
          const teamRef = firestoreDoc(this.firestore, `teams/${teamId}`);
          const teamSnap = await getDoc(teamRef);
          if (teamSnap.exists()) {
            const data = teamSnap.data() as any;
            return {
              id: teamId,
              name: `${data['city']} ${data['mascot']}`,
              city: data['city'],
              mascot: data['mascot'],
              logoUrl: data['logoUrl'],
              conference: data['conference'],
              division: data['division'],
              league: data['league'] || 'major'
            };
          }
          
          return null;
        })).then(teams => teams.filter(t => t !== null) as Team[]);
      } else if (this.teams.length > 0) {
        // If no draft order exists, create a default one
        this.draftOrder = [...this.teams];
        
        // Save the default draft order
        if (this.canManageDraft) {
          await setDoc(orderRef, {
            teams: this.draftOrder.map(t => t.id),
            createdAt: new Date()
          });
        }
      }
      
      // Load draft picks
      const picksRef = collection(this.firestore, `drafts/${this.currentDraftSeason}/picks`);
      const picksQuery = query(picksRef, orderBy('round'), orderBy('pick'));
      const picksSnap = await getDocs(picksQuery);
      
      if (picksSnap.empty && this.canManageDraft) {
        // Generate draft picks if none exist
        await this.generateDraftPicks();
        
        // Reload picks
        const newPicksSnap = await getDocs(picksQuery);
        this.draftPicks = await this.processDraftPicks(newPicksSnap);
      } else {
        this.draftPicks = await this.processDraftPicks(picksSnap);
      }
      
      // Determine current round and pick
      this.updateCurrentDraftPosition();
      
      // Check if draft is in progress
      const settingsRef = firestoreDoc(this.firestore, `drafts/${this.currentDraftSeason}/settings/status`);
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        this.draftInProgress = (settingsSnap.data() as any)['inProgress'] || false;
      }
    } catch (error) {
      console.error('Error loading current draft:', error);
    } finally {
      this.loadingDraft = false;
    }
  }
  
  async processDraftPicks(snapshot: any) {
    return await Promise.all(snapshot.docs.map(async (doc: any) => {
      const data = doc.data();
      
      // Get team name
      let teamName = 'Unknown Team';
      const team = this.teams.find(t => t.id === data['teamId']);
      if (team) {
        teamName = team.name;
      }
      
      // Get original team name if different
      let originalTeamName = undefined;
      if (data['originalTeamId'] && data['originalTeamId'] !== data['teamId']) {
        const originalTeam = this.teams.find(t => t.id === data['originalTeamId']);
        if (originalTeam) {
          originalTeamName = originalTeam.name;
        }
      }
      
      // Get player name if picked
      let playerName = undefined;
      if (data['playerId']) {
        const playerRef = firestoreDoc(this.firestore, `players/${data['playerId']}`);
        const playerSnap = await getDoc(playerRef);
        if (playerSnap.exists()) {
          const playerData = playerSnap.data() as any;
          playerName = `${playerData['firstName']} ${playerData['lastName']}`;
        }
      }
      
      return {
        id: doc.id,
        season: data['season'],
        round: data['round'],
        pick: data['pick'],
        teamId: data['teamId'],
        teamName,
        originalTeamId: data['originalTeamId'],
        originalTeamName,
        playerId: data['playerId'],
        playerName,
        completed: !!data['playerId']
      };
    }));
  }
  
  updateCurrentDraftPosition() {
    // Find the first incomplete pick
    const firstIncompletePick = this.draftPicks.find(pick => !pick.completed);
    
    if (firstIncompletePick) {
      this.currentRound = firstIncompletePick.round;
      this.currentPick = firstIncompletePick.pick;
    } else if (this.draftPicks.length > 0) {
      // All picks are complete, set to last pick
      const lastPick = this.draftPicks[this.draftPicks.length - 1];
      this.currentRound = lastPick.round;
      this.currentPick = lastPick.pick;
    }
  }
  
  async generateDraftPicks() {
    try {
      const batch = writeBatch(this.firestore);
      
      // Generate picks for each round and team
      for (let round = 1; round <= this.draftRounds; round++) {
        for (let pick = 1; pick <= this.draftOrder.length; pick++) {
          const teamIndex = pick - 1;
          const team = this.draftOrder[teamIndex];
          
          const pickRef = firestoreDoc(collection(this.firestore, `drafts/${this.currentDraftSeason}/picks`));
          
          batch.set(pickRef, {
            season: this.currentDraftSeason,
            round,
            pick,
            teamId: team.id,
            originalTeamId: team.id,
            completed: false,
            createdAt: new Date()
          });
        }
      }
      
      await batch.commit();
      console.log(`Generated ${this.draftRounds} rounds of draft picks`);
    } catch (error) {
      console.error('Error generating draft picks:', error);
    }
  }
  
  async loadDraftHistory() {
    this.loadingHistory = true;
    
    try {
      // Load past drafts (excluding current season)
      const historyQuery = query(
        collection(this.firestore, 'draftHistory'),
        orderBy('season', 'desc'),
        limit(5) // Limit to last 5 seasons
      );
      
      const historySnap = await getDocs(historyQuery);
      
      if (!historySnap.empty) {
        const historyPromises = historySnap.docs.map(async doc => {
          const data = doc.data() as any;
          const season = data['season'];
          
          // Load picks for this season
          const picksRef = collection(this.firestore, `draftHistory/${season}/picks`);
          const picksQuery = query(picksRef, orderBy('round'), orderBy('pick'));
          const picksSnap = await getDocs(picksQuery);
          
          return this.processDraftPicks(picksSnap);
        });
        
        const historyResults = await Promise.all(historyPromises);
        this.draftHistory = historyResults.flat();
      }
    } catch (error) {
      console.error('Error loading draft history:', error);
    } finally {
      this.loadingHistory = false;
    }
  }
  
  async startDraft() {
    if (!this.canManageDraft) return;
    
    try {
      // Update draft status
      const settingsRef = firestoreDoc(this.firestore, `drafts/${this.currentDraftSeason}/settings/status`);
      await setDoc(settingsRef, {
        inProgress: true,
        startedAt: new Date(),
        startedBy: this.authService.currentUser
      });
      
      // Update draft class status
      const classRef = firestoreDoc(this.firestore, `draftClasses/${this.currentDraftSeason}`);
      await updateDoc(classRef, {
        status: 'active',
        startDate: new Date()
      });
      
      this.draftInProgress = true;
    } catch (error) {
      console.error('Error starting draft:', error);
    }
  }
  
  async endDraft() {
    if (!this.canManageDraft) return;
    
    try {
      // Update draft status
      const settingsRef = firestoreDoc(this.firestore, `drafts/${this.currentDraftSeason}/settings/status`);
      await setDoc(settingsRef, {
        inProgress: false,
        endedAt: new Date(),
        endedBy: this.authService.currentUser
      });
      
      // Update draft class status
      const classRef = firestoreDoc(this.firestore, `draftClasses/${this.currentDraftSeason}`);
      await updateDoc(classRef, {
        status: 'completed',
        endDate: new Date()
      });
      
      // Move undrafted players to free agency - use simple query to avoid index issues
      try {
        const undraftedQuery = query(
          collection(this.firestore, 'players'),
          where('draftClass', '==', this.currentDraftSeason)
        );
        
        const undraftedSnap = await getDocs(undraftedQuery);
        
        const batch = writeBatch(this.firestore);
        undraftedSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data['teamId'] === 'none') {
            batch.update(doc.ref, {
              draftStatus: 'undrafted',
              freeAgent: true
            });
          }
        });
        
        await batch.commit();
      } catch (error) {
        console.error('Error updating undrafted players:', error);
      }
      
      // Archive draft to history
      await this.archiveDraftToHistory();
      
      this.draftInProgress = false;
    } catch (error) {
      console.error('Error ending draft:', error);
    }
  }
  
  async archiveDraftToHistory() {
    try {
      // Create history document
      const historyRef = firestoreDoc(this.firestore, `draftHistory/${this.currentDraftSeason}`);
      await setDoc(historyRef, {
        season: this.currentDraftSeason,
        completedAt: new Date()
      });
      
      // Copy all picks to history
      const picksRef = collection(this.firestore, `drafts/${this.currentDraftSeason}/picks`);
      const picksSnap = await getDocs(picksRef);
      
      const batch = writeBatch(this.firestore);
      
      picksSnap.docs.forEach(doc => {
        const data = doc.data();
        const historyPickRef = firestoreDoc(this.firestore, `draftHistory/${this.currentDraftSeason}/picks/${doc.id}`);
        batch.set(historyPickRef, {
          ...data,
          archivedAt: new Date()
        });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error archiving draft to history:', error);
    }
  }
  
  async openMakePickModal(pick: DraftPick) {
    if (!this.canManageDraft || !this.draftInProgress || pick.completed) return;
    
    this.selectedDraftPick = pick;
    
    // Load available players
    try {
      // Use simpler query to avoid index issues
      const playersQuery = query(
        collection(this.firestore, 'players'),
        where('draftClass', '==', this.currentDraftSeason)
      );
      
      const playersSnap = await getDocs(playersQuery);
      
      // Filter in memory instead of using complex query
      const availablePlayers = [];
      
      for (const doc of playersSnap.docs) {
        const data = doc.data() as any;
        
        // Skip players that are already on a team or drafted
        if (data['teamId'] !== 'none' || data['draftedBy']) {
          continue;
        }
        
        // Get overall rating
        let overall = 50;
        try {
          const attributesRef = firestoreDoc(this.firestore, `players/${doc.id}/meta/attributes`);
          const attributesSnap = await getDoc(attributesRef);
          if (attributesSnap.exists()) {
            const attrData = attributesSnap.data() as any;
            overall = attrData['OVERALL'] || 50;
          }
        } catch (error) {
          console.error('Error loading player attributes:', error);
        }
        
        availablePlayers.push({
          id: doc.id,
          firstName: data['firstName'] || '',
          lastName: data['lastName'] || '',
          position: data['position'] || '',
          archetype: data['archetype'] || '',
          age: data['age'] || 19,
          overall
        });
      }
      
      this.availablePlayers = availablePlayers;
      
      // Apply default sorting (by overall, descending)
      this.sortPlayers();
      
      this.showMakePickModal = true;
    } catch (error) {
      console.error('Error loading available players:', error);
    }
  }
  
  async makeDraftPick() {
    if (!this.selectedDraftPick || !this.selectedPlayerId) return;
    
    try {
      const player = this.availablePlayers.find(p => p.id === this.selectedPlayerId);
      if (!player) return;
      
      // Update draft pick
      const pickRef = firestoreDoc(this.firestore, `drafts/${this.currentDraftSeason}/picks/${this.selectedDraftPick.id}`);
      await updateDoc(pickRef, {
        playerId: player.id,
        completed: true,
        completedAt: new Date()
      });
      
      // Update player
      const playerRef = firestoreDoc(this.firestore, `players/${player.id}`);
      await updateDoc(playerRef, {
        teamId: this.selectedDraftPick.teamId,
        draftedBy: this.selectedDraftPick.teamId,
        draftRound: this.selectedDraftPick.round,
        draftPick: this.selectedDraftPick.pick,
        draftSeason: this.currentDraftSeason,
        draftStatus: 'drafted'
      });
      
      // Add player to team roster
      const rosterRef = firestoreDoc(this.firestore, `teams/${this.selectedDraftPick.teamId}/roster/${player.id}`);
      await setDoc(rosterRef, {
        firstName: player.firstName,
        lastName: player.lastName,
        position: player.position,
        archetype: player.archetype,
        jerseyNumber: Math.floor(Math.random() * 98) + 1, // Random number 1-99
        age: player.age,
        teamId: this.selectedDraftPick.teamId,
        draftRound: this.selectedDraftPick.round,
        draftPick: this.selectedDraftPick.pick,
        draftSeason: this.currentDraftSeason
      });
      
      // Add to player history
      await addDoc(collection(this.firestore, `players/${player.id}/history`), {
        action: 'drafted',
        teamId: this.selectedDraftPick.teamId,
        timestamp: new Date(),
        details: `Drafted Round ${this.selectedDraftPick.round}, Pick ${this.selectedDraftPick.pick} by ${this.selectedDraftPick.teamName}`
      });
      
      // Close modal and reload
      this.showMakePickModal = false;
      this.selectedDraftPick = null;
      this.selectedPlayerId = '';
      
      await this.loadCurrentDraft();
    } catch (error) {
      console.error('Error making draft pick:', error);
    }
  }
  
  async createDraftClass() {
    if (!this.canManageDraft) return;
    
    try {
      // Check if draft class already exists for this season
      const classRef = collection(this.firestore, 'draftClasses');
      const classQuery = query(classRef, where('season', '==', this.newDraftClassSeason));
      const classSnap = await getDocs(classQuery);
      
      if (!classSnap.empty) {
        alert(`Draft class for season ${this.newDraftClassSeason} already exists.`);
        return;
      }
      
      // Create new draft class
      await addDoc(collection(this.firestore, 'draftClasses'), {
        season: this.newDraftClassSeason,
        status: 'upcoming',
        createdAt: new Date(),
        league: this.newDraftClassLeague
      });
      
      // Close modal and reload
      this.showCreateClassModal = false;
      await this.loadDraftClasses();
    } catch (error) {
      console.error('Error creating draft class:', error);
    }
  }
  
  async createNewDraft() {
    if (!this.canManageDraft) return;
    
    try {
      // Get teams for the selected league
      const leagueTeams = this.teams.filter(team => (team.league || 'major') === this.newDraftLeague);
      
      if (leagueTeams.length === 0) {
        alert(`No teams found for ${this.newDraftLeague} league.`);
        return;
      }
      
      // Get standings to determine draft order
      const standings = await this.getStandingsForLeague(this.newDraftLeague);
      
      // Sort teams by points (worst to best)
      const sortedTeams = [...standings].sort((a, b) => {
        // First by points
        if (a.points !== b.points) return a.points - b.points;
        // Then by point percentage
        if (a.pointPercentage !== b.pointPercentage) return a.pointPercentage - b.pointPercentage;
        // Then by goal differential
        return a.goalDifferential - b.goalDifferential;
      });
      
      // Map standings teams to actual team objects
      const draftOrder = sortedTeams.map(standingsTeam => {
        return this.teams.find(team => team.id === standingsTeam.id) as Team;
      }).filter(team => team !== undefined);
      
      // Create draft settings
      const settingsRef = firestoreDoc(this.firestore, `drafts/${this.newDraftSeason}/settings/order`);
      await setDoc(settingsRef, {
        teams: draftOrder.map(t => t.id),
        league: this.newDraftLeague,
        rounds: this.newDraftRounds,
        createdAt: new Date()
      });
      
      // Generate draft picks
      const batch = writeBatch(this.firestore);
      
      for (let round = 1; round <= this.newDraftRounds; round++) {
        for (let pick = 1; pick <= draftOrder.length; pick++) {
          const teamIndex = pick - 1;
          const team = draftOrder[teamIndex];
          
          const pickRef = firestoreDoc(collection(this.firestore, `drafts/${this.newDraftSeason}/picks`));
          
          batch.set(pickRef, {
            season: this.newDraftSeason,
            round,
            pick,
            teamId: team.id,
            originalTeamId: team.id,
            completed: false,
            createdAt: new Date()
          });
        }
      }
      
      await batch.commit();
      
      // Create draft status
      const statusRef = firestoreDoc(this.firestore, `drafts/${this.newDraftSeason}/settings/status`);
      await setDoc(statusRef, {
        inProgress: false,
        league: this.newDraftLeague,
        createdAt: new Date()
      });
      
      // Close modal and reload
      this.showCreateDraftModal = false;
      this.currentDraftSeason = this.newDraftSeason;
      await this.loadCurrentDraft();
      
      alert(`Draft created successfully for ${this.newDraftLeague} league with ${this.newDraftRounds} rounds.`);
    } catch (error) {
      console.error('Error creating draft:', error);
      alert('Error creating draft. See console for details.');
    }
  }
  
  async getStandingsForLeague(league: string): Promise<StandingsTeam[]> {
    try {
      // Get all teams for this league
      const leagueTeams = this.teams.filter(team => (team.league || 'major') === league);
      
      // For each team, get their games and calculate standings
      const standingsPromises = leagueTeams.map(async (team) => {
        const gamesRef = collection(this.firestore, `teams/${team.id}/games`);
        const gamesSnapshot = await getDocs(gamesRef);
        const games = gamesSnapshot.docs.map(doc => doc.data());
        
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
          pointPercentage
        };
      });
      
      return await Promise.all(standingsPromises);
    } catch (error) {
      console.error('Error getting standings for league:', error);
      return [];
    }
  }
  
  // Helper methods for filtering and sorting
  filterPlayers(): DraftPlayer[] {
    if (!this.selectedDraftClass) return [];
    
    let filtered = [...this.selectedDraftClass.players];
    
    // Apply position filter
    if (this.positionFilter !== 'all') {
      filtered = filtered.filter(p => p.position === this.positionFilter);
    }
    
    // Apply age filter
    if (this.ageFilter !== 'all') {
      const age = parseInt(this.ageFilter);
      filtered = filtered.filter(p => p.age === age);
    }
    
    return filtered;
  }
  
  sortPlayers() {
    if (!this.availablePlayers) return;
    
    this.availablePlayers.sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortBy) {
        case 'overall':
          comparison = b.overall - a.overall;
          break;
        case 'age':
          comparison = a.age - b.age;
          break;
        case 'position':
          // Order: G, D, C, LW, RW
          const posOrder: Record<string, number> = { 'G': 1, 'D': 2, 'C': 3, 'LW': 4, 'RW': 5 };
          comparison = (posOrder[a.position] || 99) - (posOrder[b.position] || 99);
          break;
      }
      
      // Apply sort direction
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }
  
  // UI helper methods
  getPositionColor(position: string): string {
    switch (position) {
      case 'G': return '#dc3545'; // Red
      case 'D': return '#fd7e14'; // Orange
      case 'C': return '#28a745'; // Green
      case 'LW': return '#17a2b8'; // Teal
      case 'RW': return '#007bff'; // Blue
      default: return '#6c757d'; // Gray
    }
  }
  
  getOverallColor(overall: number): string {
    // Clamp the value between 50 and 99
    const clampedOverall = Math.max(50, Math.min(99, overall));
    
    // Calculate the percentage from 50 to 99 (0% to 100%)
    const percentage = (clampedOverall - 50) / (99 - 50);
    
    // Use a more vibrant red to green interpolation
    const red = Math.round(220 - (220 - 34) * percentage);
    const green = Math.round(38 + (197 - 38) * percentage);
    const blue = Math.round(38 + (94 - 38) * percentage);
    
    return `rgb(${red}, ${green}, ${blue})`;
  }
  
  getCurrentDraftPick(): DraftPick | null {
    return this.draftPicks.find(p => p.round === this.currentRound && p.pick === this.currentPick) || null;
  }
  
  getDraftPicksForRound(round: number): DraftPick[] {
    return this.draftPicks.filter(p => p.round === round);
  }
  
  getTeamLogo(teamId: string): string {
    const team = this.teams.find(t => t.id === teamId);
    return team?.logoUrl || '';
  }
  
  getTeamName(teamId: string): string {
    const team = this.teams.find(t => t.id === teamId);
    return team?.name || 'Unknown Team';
  }
  
  // Draft class management
  selectDraftClass(draftClass: DraftClass) {
    this.selectedDraftClass = draftClass;
  }
  
  // Draft navigation
  goToRound(round: number) {
    this.currentRound = round;
  }

  // Get unique seasons from draft history
  getUniqueDraftSeasons(): number[] {
    const seasons = this.draftHistory.map(p => p.season);
    const uniqueSeasons = [...new Set(seasons)];
    return uniqueSeasons.sort((a, b) => b - a);
  }

  // Get picks for a specific season
  getPicksForSeason(season: number): DraftPick[] {
    return this.draftHistory.filter(p => p.season === season);
  }

  // Get the index error URL from the error message
  getIndexUrl(): string {
    if (!this.indexErrorMessage) return '';
    
    const match = this.indexErrorMessage.match(/https:\/\/console\.firebase\.google\.com\/[^\s]+/);
    return match ? match[0] : '';
  }
}