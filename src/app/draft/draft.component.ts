import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, doc, getDoc, query, where, orderBy, limit, addDoc, setDoc, updateDoc, writeBatch } from '@angular/fire/firestore';
import { AuthService } from '../auth.service';

interface DraftClass {
  id?: string;
  season: number;
  players: DraftPlayer[];
  status: 'upcoming' | 'active' | 'completed';
  startDate?: Date;
  endDate?: Date;
  league?: string;
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
  teamId?: string;
  teamName?: string;
  teamLogo?: string;
  draftRound?: number;
  draftPick?: number;
  draftSeason?: number;
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
  availableSeasons: number[] = [];
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
  newDraftClassLeague = 'major';
  
  // Draft creation
  showCreateDraftModal = false;
  newDraftSeason = new Date().getFullYear();
  newDraftLeague = 'major';
  newDraftRounds = 7;
  
  // Draft pick management
  showMakePickModal = false;
  selectedDraftPick: DraftPick | null = null;
  availablePlayers: DraftPlayer[] = [];
  selectedPlayerId = '';
  
  // Draft settings
  draftRounds = 7;
  
  // Filters
  positionFilter: string = 'all';
  ageFilter: string = 'all';
  sortBy: 'overall' | 'age' | 'position' = 'overall';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Error handling
  indexError = false;
  indexUrl = '';
  draftClassError = false;
  draftClassErrorMessage = '';

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
    
    // Load teams first
    await this.loadTeams();
    
    // Load available seasons
    await this.loadAvailableSeasons();
    
    // Load draft classes
    await this.loadDraftClasses();
    
    // Load current draft
    await this.loadCurrentDraft();
    
    // Load draft history
    await this.loadDraftHistory();
  }
  
  async loadTeams() {
    console.log('🏒 Loading teams...');
    const teamsRef = collection(this.firestore, 'teams');
    const snapshot = await getDocs(teamsRef);
    
    this.teams = snapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();
      return {
        id: docSnapshot.id,
        name: `${data['city']} ${data['mascot']}`,
        city: data['city'],
        mascot: data['mascot'],
        logoUrl: data['logoUrl'],
        conference: data['conference'],
        division: data['division'],
        league: data['league'] || 'major'
      };
    });
    
    console.log(`✅ Loaded ${this.teams.length} teams`);
  }

  async loadAvailableSeasons() {
    try {
      // Get current league season
      const seasonRef = doc(this.firestore, 'leagueSettings/season');
      const seasonSnap = await getDoc(seasonRef);
      const currentSeason = seasonSnap.exists() ? seasonSnap.data()['currentSeason'] : 1;
      
      // Create array of available seasons (current and previous)
      this.availableSeasons = [];
      for (let i = 1; i <= currentSeason; i++) {
        this.availableSeasons.push(i);
      }
      
      // Set current draft season to the current league season
      this.currentDraftSeason = currentSeason;
      this.newDraftSeason = currentSeason;
      this.newDraftClassSeason = currentSeason;
      
      console.log(`📅 Available seasons: ${this.availableSeasons.join(', ')}`);
    } catch (error) {
      console.error('Error loading available seasons:', error);
      this.availableSeasons = [1];
      this.currentDraftSeason = 1;
    }
  }

  async onDraftSeasonChange() {
    console.log(`🔄 Draft season changed to: ${this.currentDraftSeason}`);
    await this.loadCurrentDraft();
  }
  
  async loadDraftClasses() {
    this.loadingClasses = true;
    this.draftClassError = false;
    
    try {
      // Load draft classes from Firestore
      const classesRef = collection(this.firestore, 'draftClasses');
      const snapshot = await getDocs(classesRef);
      
      if (snapshot.empty) {
        // Create initial draft class for current season if none exist
        await this.createInitialDraftClass(this.currentDraftSeason);
        await this.loadDraftClasses(); // Reload after creation
        return;
      }
      
      // Process draft classes
      this.draftClasses = await Promise.all(snapshot.docs.map(async docSnapshot => {
        const data = docSnapshot.data();
        
        // Load players for this draft class using draftClass field
        try {
          const playersQuery = query(
            collection(this.firestore, 'players'),
            where('draftClass', '==', data['season']),
            where('status', '==', 'active')
          );
          
          const playersSnapshot = await getDocs(playersQuery);
          const players = await Promise.all(playersSnapshot.docs.map(async playerDoc => {
            const playerData = playerDoc.data();
            
            // Get overall rating from attributes
            let overall = 50;
            try {
              const attributesRef = doc(this.firestore, `players/${playerDoc.id}/meta/attributes`);
              const attributesSnap = await getDoc(attributesRef);
              if (attributesSnap.exists()) {
                const attributesData = attributesSnap.data();
                overall = attributesData['OVERALL'] || 50;
              }
            } catch (error) {
              console.error('Error loading player attributes:', error);
            }
            
            // Get team information if player has been assigned
            let teamName = undefined;
            let teamLogo = undefined;
            if (playerData['teamId'] && playerData['teamId'] !== 'none') {
              const team = this.teams.find(t => t.id === playerData['teamId']);
              if (team) {
                teamName = team.name;
                teamLogo = team.logoUrl;
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
              teamId: playerData['teamId'],
              teamName,
              teamLogo,
              draftRound: playerData['draftRound'],
              draftPick: playerData['draftPick'],
              draftSeason: playerData['draftSeason']
            };
          }));
          
          return {
            id: docSnapshot.id,
            season: data['season'],
            players,
            status: data['status'] || 'upcoming',
            startDate: data['startDate'],
            endDate: data['endDate'],
            league: data['league'] || 'major'
          };
        } catch (error) {
          console.error(`Error loading players for draft class ${data['season']}:`, error);
          
          // Check if this is an index error
          if (error instanceof Error && error.toString().includes('requires an index')) {
            this.indexError = true;
            this.indexUrl = 'https://console.firebase.google.com/project/gohls-3033e/firestore/indexes';
          }
          
          // Return draft class with empty players array
          return {
            id: docSnapshot.id,
            season: data['season'],
            players: [],
            status: data['status'] || 'upcoming',
            startDate: data['startDate'],
            endDate: data['endDate'],
            league: data['league'] || 'major'
          };
        }
      }));
      
      // Sort draft classes by season (newest first)
      this.draftClasses.sort((a, b) => b.season - a.season);
      
      // Set selected draft class to the most recent one
      if (this.draftClasses.length > 0) {
        this.selectedDraftClass = this.draftClasses[0];
      }
    } catch (error) {
      console.error('Error loading draft classes:', error);
      this.draftClassError = true;
      this.draftClassErrorMessage = 'Failed to load draft classes. Please try again.';
      
      // Check if this is an index error
      if (error instanceof Error && error.toString().includes('requires an index')) {
        this.indexError = true;
        this.indexUrl = 'https://console.firebase.google.com/project/gohls-3033e/firestore/indexes';
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
        league: 'major',
        createdAt: new Date()
      });
      
      console.log(`Created initial draft class for season ${season}`);
    } catch (error) {
      console.error('Error creating initial draft class:', error);
    }
  }
  
  async loadCurrentDraft() {
    this.loadingDraft = true;
    
    try {
      console.log(`🎯 Loading draft for season ${this.currentDraftSeason}`);
      
      // Load draft order
      const orderRef = doc(this.firestore, `drafts/${this.currentDraftSeason}/settings/order`);
      const orderSnap = await getDoc(orderRef);
      
      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        const teamIds = orderData['teams'] || [];
        
        console.log(`📋 Found draft order with ${teamIds.length} teams`);
        
        // Load team details for the draft order
        this.draftOrder = [];
        for (const teamId of teamIds) {
          const team = this.teams.find(t => t.id === teamId);
          if (team) {
            this.draftOrder.push(team);
          } else {
            console.warn(`Team ${teamId} not found in teams list`);
          }
        }
        
        console.log(`✅ Loaded draft order: ${this.draftOrder.map(t => t.name).join(', ')}`);
      } else {
        console.log('📝 No draft order found, creating default order');
        
        // If no draft order exists, create a default one based on current league
        const majorLeagueTeams = this.teams.filter(t => (t.league || 'major') === 'major');
        this.draftOrder = majorLeagueTeams;
        
        // Save the default draft order if user can manage drafts
        if (this.canManageDraft && this.draftOrder.length > 0) {
          await setDoc(orderRef, {
            teams: this.draftOrder.map(t => t.id),
            createdAt: new Date()
          });
          console.log(`💾 Saved default draft order with ${this.draftOrder.length} teams`);
        }
      }
      
      // Load draft picks
      try {
        const picksRef = collection(this.firestore, `drafts/${this.currentDraftSeason}/picks`);
        const picksQuery = query(picksRef, orderBy('round'), orderBy('pick'));
        const picksSnap = await getDocs(picksQuery);
        
        if (picksSnap.empty && this.canManageDraft && this.draftOrder.length > 0) {
          console.log('🔧 Generating draft picks...');
          // Generate draft picks if none exist
          await this.generateDraftPicks();
          
          // Reload picks
          const newPicksSnap = await getDocs(picksQuery);
          this.draftPicks = await this.processDraftPicks(newPicksSnap);
        } else {
          this.draftPicks = await this.processDraftPicks(picksSnap);
        }
        
        console.log(`🎯 Loaded ${this.draftPicks.length} draft picks`);
      } catch (error) {
        console.error('Error loading draft picks:', error);
        
        // Check if this is an index error
        if (error instanceof Error && error.toString().includes('requires an index')) {
          this.indexError = true;
          this.indexUrl = 'https://console.firebase.google.com/project/gohls-3033e/firestore/indexes';
          this.draftPicks = []; // Reset picks to empty array
        }
      }
      
      // Determine current round and pick
      this.updateCurrentDraftPosition();
      
      // Check if draft is in progress
      const settingsRef = doc(this.firestore, `drafts/${this.currentDraftSeason}/settings/status`);
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        this.draftInProgress = settingsSnap.data()['inProgress'] || false;
      }
      
      console.log(`🏒 Draft status: ${this.draftInProgress ? 'In Progress' : 'Not Started'}`);
    } catch (error) {
      console.error('Error loading current draft:', error);
      
      // Check if this is an index error
      if (error instanceof Error && error.toString().includes('requires an index')) {
        this.indexError = true;
        this.indexUrl = 'https://console.firebase.google.com/project/gohls-3033e/firestore/indexes';
      }
    } finally {
      this.loadingDraft = false;
    }
  }
  
  async processDraftPicks(snapshot: any) {
    return await Promise.all(snapshot.docs.map(async (docSnapshot: any) => {
      const data = docSnapshot.data();
      
      // Get team name from our loaded teams
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
        try {
          const playerRef = doc(this.firestore, `players/${data['playerId']}`);
          const playerSnap = await getDoc(playerRef);
          if (playerSnap.exists()) {
            const playerData = playerSnap.data() as any;
            playerName = `${playerData['firstName']} ${playerData['lastName']}`;
          }
        } catch (error) {
          console.error('Error loading player data:', error);
        }
      }
      
      return {
        id: docSnapshot.id,
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
      
      console.log(`🔧 Generating ${this.draftRounds} rounds for ${this.draftOrder.length} teams`);
      
      // Generate picks for each round and team
      for (let round = 1; round <= this.draftRounds; round++) {
        for (let pick = 1; pick <= this.draftOrder.length; pick++) {
          const teamIndex = pick - 1;
          const team = this.draftOrder[teamIndex];
          
          const pickRef = doc(collection(this.firestore, `drafts/${this.currentDraftSeason}/picks`));
          
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
      console.log(`✅ Generated ${this.draftRounds} rounds of draft picks`);
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
        const historyPromises = historySnap.docs.map(async docSnapshot => {
          const data = docSnapshot.data();
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
      
      // Check if this is an index error
      if (error instanceof Error && error.toString().includes('requires an index')) {
        this.indexError = true;
        this.indexUrl = 'https://console.firebase.google.com/project/gohls-3033e/firestore/indexes';
      }
    } finally {
      this.loadingHistory = false;
    }
  }
  
  async startDraft() {
    if (!this.canManageDraft) return;
    
    try {
      // Get current user
      const currentUser = await new Promise((resolve) => {
        this.authService.currentUser.subscribe(user => resolve(user));
      });
      
      // Update draft status
      const settingsRef = doc(this.firestore, `drafts/${this.currentDraftSeason}/settings/status`);
      await setDoc(settingsRef, {
        inProgress: true,
        startedAt: new Date(),
        startedBy: (currentUser as any)?.uid || 'unknown'
      });
      
      // Find the draft class for this season and update its status
      const draftClass = this.draftClasses.find(dc => dc.season === this.currentDraftSeason);
      if (draftClass && draftClass.id) {
        const classRef = doc(this.firestore, `draftClasses/${draftClass.id}`);
        await updateDoc(classRef, {
          status: 'active',
          startDate: new Date()
        });
      } else {
        console.warn(`No draft class found for season ${this.currentDraftSeason}`);
      }
      
      this.draftInProgress = true;
    } catch (error) {
      console.error('Error starting draft:', error);
    }
  }
  
  async endDraft() {
    if (!this.canManageDraft) return;
    
    try {
      // Get current user
      const currentUser = await new Promise((resolve) => {
        this.authService.currentUser.subscribe(user => resolve(user));
      });
      
      // Update draft status
      const settingsRef = doc(this.firestore, `drafts/${this.currentDraftSeason}/settings/status`);
      await setDoc(settingsRef, {
        inProgress: false,
        endedAt: new Date(),
        endedBy: (currentUser as any)?.uid || 'unknown'
      });
      
      // Find the draft class for this season and update its status
      const draftClass = this.draftClasses.find(dc => dc.season === this.currentDraftSeason);
      if (draftClass && draftClass.id) {
        const classRef = doc(this.firestore, `draftClasses/${draftClass.id}`);
        await updateDoc(classRef, {
          status: 'completed',
          endDate: new Date()
        });
      }
      
      // Move undrafted players to free agency
      const undraftedQuery = query(
        collection(this.firestore, 'players'),
        where('draftClass', '==', this.currentDraftSeason),
        where('teamId', '==', 'none')
      );
      
      const undraftedSnap = await getDocs(undraftedQuery);
      
      const batch = writeBatch(this.firestore);
      undraftedSnap.docs.forEach(docSnapshot => {
        batch.update(docSnapshot.ref, {
          draftStatus: 'undrafted',
          freeAgent: true
        });
      });
      
      await batch.commit();
      
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
      const historyRef = doc(this.firestore, `draftHistory/${this.currentDraftSeason}`);
      await setDoc(historyRef, {
        season: this.currentDraftSeason,
        completedAt: new Date()
      });
      
      // Copy all picks to history
      const picksRef = collection(this.firestore, `drafts/${this.currentDraftSeason}/picks`);
      const picksSnap = await getDocs(picksRef);
      
      const batch = writeBatch(this.firestore);
      
      picksSnap.docs.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const historyPickRef = doc(this.firestore, `draftHistory/${this.currentDraftSeason}/picks/${docSnapshot.id}`);
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
    
    // Load available players from the current draft class for the current season
    try {
      console.log(`Loading players for draft season ${this.currentDraftSeason}`);
      
      try {
        const playersQuery = query(
          collection(this.firestore, 'players'),
          where('draftClass', '==', this.currentDraftSeason),
          where('teamId', '==', 'none'),
          where('status', '==', 'active')
        );
        
        const playersSnap = await getDocs(playersQuery);
        console.log(`Found ${playersSnap.docs.length} available players for season ${this.currentDraftSeason}`);
        
        this.availablePlayers = await Promise.all(playersSnap.docs.map(async docSnapshot => {
          const data = docSnapshot.data();
          
          // Get overall rating
          let overall = 50;
          try {
            const attributesRef = doc(this.firestore, `players/${docSnapshot.id}/meta/attributes`);
            const attributesSnap = await getDoc(attributesRef);
            if (attributesSnap.exists()) {
              const attributesData = attributesSnap.data();
              overall = attributesData['OVERALL'] || 50;
            }
          } catch (error) {
            console.error('Error loading player attributes:', error);
          }
          
          return {
            id: docSnapshot.id,
            firstName: data['firstName'] || '',
            lastName: data['lastName'] || '',
            position: data['position'] || '',
            archetype: data['archetype'] || '',
            age: data['age'] || 19,
            overall
          };
        }));
      } catch (error) {
        console.error('Error querying players:', error);
        
        // Check if this is an index error
        if (error instanceof Error && error.toString().includes('requires an index')) {
          this.indexError = true;
          this.indexUrl = 'https://console.firebase.google.com/project/gohls-3033e/firestore/indexes';
          this.availablePlayers = []; // Reset to empty array
        }
      }
      
      // Apply default sorting (by overall, descending)
      this.sortPlayers();
      
      this.showMakePickModal = true;
    } catch (error) {
      console.error('Error loading available players:', error);
      alert('Error loading available players. Please try again.');
    }
  }
  
  async makeDraftPick() {
    if (!this.selectedDraftPick || !this.selectedPlayerId) return;
    
    try {
      const player = this.availablePlayers.find(p => p.id === this.selectedPlayerId);
      if (!player) return;
      
      // Update draft pick
      const pickRef = doc(this.firestore, `drafts/${this.currentDraftSeason}/picks/${this.selectedDraftPick.id}`);
      await updateDoc(pickRef, {
        playerId: player.id,
        completed: true,
        completedAt: new Date()
      });
      
      // Update player
      const playerRef = doc(this.firestore, `players/${player.id}`);
      await updateDoc(playerRef, {
        teamId: this.selectedDraftPick.teamId,
        draftedBy: this.selectedDraftPick.teamId,
        draftRound: this.selectedDraftPick.round,
        draftPick: this.selectedDraftPick.pick,
        draftSeason: this.currentDraftSeason,
        draftStatus: 'drafted'
      });
      
      // Add player to team roster
      const rosterRef = doc(this.firestore, `teams/${this.selectedDraftPick.teamId}/roster/${player.id}`);
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
      const docRef = await addDoc(collection(this.firestore, 'draftClasses'), {
        season: this.newDraftClassSeason,
        status: 'upcoming',
        league: this.newDraftClassLeague,
        createdAt: new Date()
      });
      
      console.log(`Created draft class for season ${this.newDraftClassSeason} with ID: ${docRef.id}`);
      
      // Close modal and reload
      this.showCreateClassModal = false;
      await this.loadDraftClasses();
      
      // Refresh available seasons
      await this.loadAvailableSeasons();
      
      // Show success message
      alert(`Draft class for Season ${this.newDraftClassSeason} created successfully!`);
    } catch (error) {
      console.error('Error creating draft class:', error);
      alert('Failed to create draft class. Please try again.');
    }
  }

  async createNewDraft() {
    if (!this.canManageDraft) return;
    
    try {
      // Get teams for the selected league
      const leagueTeams = this.teams.filter(t => (t.league || 'major') === this.newDraftLeague);
      
      if (leagueTeams.length === 0) {
        alert(`No teams found for ${this.newDraftLeague} league.`);
        return;
      }
      
      // Create draft order (for now, just use team order - in real implementation, this would be based on standings)
      const orderRef = doc(this.firestore, `drafts/${this.newDraftSeason}/settings/order`);
      await setDoc(orderRef, {
        teams: leagueTeams.map(t => t.id),
        league: this.newDraftLeague,
        createdAt: new Date()
      });
      
      // Generate draft picks
      const batch = writeBatch(this.firestore);
      
      for (let round = 1; round <= this.newDraftRounds; round++) {
        for (let pick = 1; pick <= leagueTeams.length; pick++) {
          const teamIndex = pick - 1;
          const team = leagueTeams[teamIndex];
          
          const pickRef = doc(collection(this.firestore, `drafts/${this.newDraftSeason}/picks`));
          
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
      
      // Update current draft season
      this.currentDraftSeason = this.newDraftSeason;
      
      // Close modal and reload
      this.showCreateDraftModal = false;
      await this.loadCurrentDraft();
      
      alert(`Draft created successfully for Season ${this.newDraftSeason}!`);
    } catch (error) {
      console.error('Error creating new draft:', error);
      alert('Failed to create draft. Please try again.');
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
          const posOrder = { 'G': 1, 'D': 2, 'C': 3, 'LW': 4, 'RW': 5 };
          comparison = (posOrder[a.position as keyof typeof posOrder] || 99) - 
                      (posOrder[b.position as keyof typeof posOrder] || 99);
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
    
    // Use a more vibrant red to green interpolation avoiding brown tones
    // Red: RGB(220, 38, 38) - Bright red
    // Green: RGB(34, 197, 94) - Bright green
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

  // Draft history helper methods
  getUniqueDraftSeasons(): number[] {
    const seasons = [...new Set(this.draftHistory.map(p => p.season))];
    return seasons.sort((a, b) => b - a);
  }

  getPicksForSeason(season: number): DraftPick[] {
    return this.draftHistory.filter(p => p.season === season);
  }
}