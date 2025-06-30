import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, doc, getDoc, query, where, orderBy, limit, addDoc, setDoc, updateDoc, writeBatch, deleteDoc } from '@angular/fire/firestore';
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

interface Draft {
  id?: string;
  season: number;
  league: string;
  rounds: number;
  status: 'not_started' | 'in_progress' | 'completed';
  draftClassId?: string;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
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
  drafts: Draft[] = [];
  selectedDraft: Draft | null = null;
  draftOrder: Team[] = [];
  draftPicks: DraftPick[] = [];
  currentRound = 1;
  currentPick = 1;
  
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
  
  // Draft order management
  showManageDraftOrderModal = false;
  availableTeams: Team[] = [];
  draftOrderTeams: Team[] = [];
  
  // Filters
  positionFilter: string = 'all';
  ageFilter: string = 'all';
  sortBy: 'overall' | 'age' | 'position' = 'overall';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Error handling
  indexError = false;
  indexUrl = 'https://console.firebase.google.com/u/1/project/gohls-3033e/firestore/indexes';
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
    
    // Load draft classes
    await this.loadDraftClasses();
    
    // Load drafts
    await this.loadDrafts();
    
    // Load draft history
    await this.loadDraftHistory();
  }
  
  async loadTeams() {
    console.log('🏒 Loading teams...');
    try {
      const teamsRef = collection(this.firestore, 'teams');
      const snapshot = await getDocs(teamsRef);
      
      this.teams = snapshot.docs.map(doc => {
        const data = doc.data();
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
      
      console.log(`✅ Loaded ${this.teams.length} teams`);
    } catch (error) {
      console.error('Error loading teams:', error);
      this.teams = [];
    }
  }
  
  async loadDraftClasses() {
    this.loadingClasses = true;
    this.draftClassError = false;
    
    try {
      // Get current league season
      const seasonRef = doc(this.firestore, 'leagueSettings/season');
      const seasonSnap = await getDoc(seasonRef);
      const currentSeason = seasonSnap.exists() ? seasonSnap.data()['currentSeason'] : 1;
      
      // Load draft classes from Firestore
      const classesRef = collection(this.firestore, 'draftClasses');
      const snapshot = await getDocs(classesRef);
      
      if (snapshot.empty) {
        // Create initial draft class for current season if none exist
        await this.createInitialDraftClass(currentSeason);
        await this.loadDraftClasses(); // Reload after creation
        return;
      }
      
      // Process draft classes
      this.draftClasses = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data();
        
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
                overall = attributesSnap.data()['OVERALL'] || 50;
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
            id: doc.id,
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
            this.indexUrl = this.extractIndexUrl(error.toString());
          }
          
          // Return draft class with empty players array
          return {
            id: doc.id,
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
        this.indexUrl = this.extractIndexUrl(error.toString());
      }
    } finally {
      this.loadingClasses = false;
    }
  }
  
  async createInitialDraftClass(season: number) {
    try {
      // Create draft class document
      const docRef = await addDoc(collection(this.firestore, 'draftClasses'), {
        season,
        status: 'upcoming',
        league: 'major',
        createdAt: new Date()
      });
      
      console.log(`Created initial draft class for season ${season} with ID: ${docRef.id}`);
    } catch (error) {
      console.error('Error creating initial draft class:', error);
    }
  }
  
  async loadDrafts() {
    this.loadingDraft = true;
    
    try {
      // Load all drafts
      const draftsRef = collection(this.firestore, 'drafts');
      const draftsSnap = await getDocs(draftsRef);
      
      this.drafts = draftsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Draft));
      
      // Sort drafts by season (descending)
      this.drafts.sort((a, b) => b.season - a.season);
      
      // Select the most recent draft
      if (this.drafts.length > 0) {
        this.selectedDraft = this.drafts[0];
        await this.loadDraftDetails(this.selectedDraft);
      }
    } catch (error) {
      console.error('Error loading drafts:', error);
    } finally {
      this.loadingDraft = false;
    }
  }
  
  async loadDraftDetails(draft: Draft) {
    if (!draft || !draft.id) return;
    
    try {
      console.log(`🎯 Loading details for draft season ${draft.season}`);
      
      // Load draft order
      const orderRef = doc(this.firestore, `drafts/${draft.id}/settings/order`);
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
        console.log('📝 No draft order found for this draft');
        this.draftOrder = [];
      }
      
      // Load draft picks
      try {
        const picksRef = collection(this.firestore, `drafts/${draft.id}/picks`);
        const picksQuery = query(picksRef, orderBy('round'), orderBy('pick'));
        const picksSnap = await getDocs(picksQuery);
        
        this.draftPicks = await this.processDraftPicks(picksSnap);
        console.log(`🎯 Loaded ${this.draftPicks.length} draft picks`);
        
        // Determine current round and pick
        this.updateCurrentDraftPosition();
      } catch (error) {
        console.error('Error loading draft picks:', error);
        
        // Check if this is an index error
        if (error instanceof Error && error.toString().includes('requires an index')) {
          this.indexError = true;
          this.indexUrl = this.extractIndexUrl(error.toString());
          this.draftPicks = []; // Reset picks to empty array
        }
      }
    } catch (error) {
      console.error('Error loading draft details:', error);
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
        const playerRef = doc(this.firestore, `players/${data['playerId']}`);
        const playerSnap = await getDoc(playerRef);
        if (playerSnap.exists()) {
          const playerData = playerSnap.data();
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
          const data = doc.data();
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
        this.indexUrl = this.extractIndexUrl(error.toString());
      }
    } finally {
      this.loadingHistory = false;
    }
  }
  
  async startDraft() {
    if (!this.canManageDraft || !this.selectedDraft) return;
    
    try {
      // Get current user
      const currentUser = await new Promise((resolve) => {
        this.authService.currentUser.subscribe(user => resolve(user));
      });
      
      // Update draft status
      await updateDoc(doc(this.firestore, `drafts/${this.selectedDraft.id}`), {
        status: 'in_progress',
        startDate: new Date()
      });
      
      // Find the draft class for this season and update its status
      const draftClass = this.draftClasses.find(dc => dc.season === this.selectedDraft?.season);
      if (draftClass && draftClass.id) {
        await updateDoc(doc(this.firestore, `draftClasses/${draftClass.id}`), {
          status: 'active',
          startDate: new Date()
        });
      }
      
      // Update local state
      this.selectedDraft.status = 'in_progress';
      this.selectedDraft.startDate = new Date();
    } catch (error) {
      console.error('Error starting draft:', error);
      alert('Failed to start draft. Please try again.');
    }
  }
  
  async endDraft() {
    if (!this.canManageDraft || !this.selectedDraft) return;
    
    try {
      // Get current user
      const currentUser = await new Promise((resolve) => {
        this.authService.currentUser.subscribe(user => resolve(user));
      });
      
      // Update draft status
      await updateDoc(doc(this.firestore, `drafts/${this.selectedDraft.id}`), {
        status: 'completed',
        endDate: new Date()
      });
      
      // Find the draft class for this season and update its status
      const draftClass = this.draftClasses.find(dc => dc.season === this.selectedDraft?.season);
      if (draftClass && draftClass.id) {
        await updateDoc(doc(this.firestore, `draftClasses/${draftClass.id}`), {
          status: 'completed',
          endDate: new Date()
        });
      }
      
      // Move undrafted players to free agency
      const undraftedQuery = query(
        collection(this.firestore, 'players'),
        where('draftClass', '==', this.selectedDraft.season),
        where('teamId', '==', 'none')
      );
      
      const undraftedSnap = await getDocs(undraftedQuery);
      
      const batch = writeBatch(this.firestore);
      undraftedSnap.docs.forEach(doc => {
        batch.update(doc.ref, {
          draftStatus: 'undrafted',
          freeAgent: true
        });
      });
      
      await batch.commit();
      
      // Archive draft to history
      await this.archiveDraftToHistory();
      
      // Update local state
      this.selectedDraft.status = 'completed';
      this.selectedDraft.endDate = new Date();
    } catch (error) {
      console.error('Error ending draft:', error);
      alert('Failed to end draft. Please try again.');
    }
  }
  
  async archiveDraftToHistory() {
    if (!this.selectedDraft) return;
    
    try {
      // Create history document
      const historyRef = doc(this.firestore, `draftHistory/${this.selectedDraft.season}`);
      await setDoc(historyRef, {
        season: this.selectedDraft.season,
        completedAt: new Date()
      });
      
      // Copy all picks to history
      const picksRef = collection(this.firestore, `drafts/${this.selectedDraft.id}/picks`);
      const picksSnap = await getDocs(picksRef);
      
      const batch = writeBatch(this.firestore);
      
      picksSnap.docs.forEach(doc => {
        const data = doc.data();
        const historyPickRef = doc(this.firestore, `draftHistory/${this.selectedDraft!.season}/picks/${doc.id}`);
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
    if (!this.canManageDraft || !this.selectedDraft || this.selectedDraft.status !== 'in_progress' || pick.completed) return;
    
    this.selectedDraftPick = pick;
    
    // Load available players from the current draft class
    try {
      console.log(`Loading players for draft season ${this.selectedDraft.season}`);
      
      try {
        const playersQuery = query(
          collection(this.firestore, 'players'),
          where('draftClass', '==', this.selectedDraft.season),
          where('teamId', '==', 'none'),
          where('status', '==', 'active')
        );
        
        const playersSnap = await getDocs(playersQuery);
        console.log(`Found ${playersSnap.docs.length} available players for season ${this.selectedDraft.season}`);
        
        this.availablePlayers = await Promise.all(playersSnap.docs.map(async doc => {
          const data = doc.data();
          
          // Get overall rating
          let overall = 50;
          try {
            const attributesRef = doc(this.firestore, `players/${doc.id}/meta/attributes`);
            const attributesSnap = await getDoc(attributesRef);
            if (attributesSnap.exists()) {
              const attributesData = attributesSnap.data();
              overall = attributesData['OVERALL'] || 50;
            }
          } catch (error) {
            console.error('Error loading player attributes:', error);
          }
          
          return {
            id: doc.id,
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
          this.indexUrl = this.extractIndexUrl(error.toString());
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
    if (!this.selectedDraftPick || !this.selectedPlayerId || !this.selectedDraft) return;
    
    try {
      const player = this.availablePlayers.find(p => p.id === this.selectedPlayerId);
      if (!player) return;
      
      // Update draft pick
      const pickRef = doc(this.firestore, `drafts/${this.selectedDraft.id}/picks/${this.selectedDraftPick.id}`);
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
        draftSeason: this.selectedDraft.season,
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
        draftSeason: this.selectedDraft.season
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
      
      await this.loadDraftDetails(this.selectedDraft);
    } catch (error) {
      console.error('Error making draft pick:', error);
      alert('Failed to make draft pick. Please try again.');
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
      // Check if draft already exists for this season
      const draftsRef = collection(this.firestore, 'drafts');
      const draftsQuery = query(draftsRef, where('season', '==', this.newDraftSeason));
      const draftsSnap = await getDocs(draftsQuery);
      
      if (!draftsSnap.empty) {
        alert(`Draft for season ${this.newDraftSeason} already exists.`);
        return;
      }
      
      // Find the draft class for this season
      const classesRef = collection(this.firestore, 'draftClasses');
      const classesQuery = query(classesRef, where('season', '==', this.newDraftSeason));
      const classesSnap = await getDocs(classesQuery);
      
      let draftClassId = null;
      if (!classesSnap.empty) {
        draftClassId = classesSnap.docs[0].id;
      } else {
        // Create a draft class if one doesn't exist
        const newClassRef = await addDoc(collection(this.firestore, 'draftClasses'), {
          season: this.newDraftSeason,
          status: 'upcoming',
          league: this.newDraftLeague,
          createdAt: new Date()
        });
        draftClassId = newClassRef.id;
      }
      
      // Create the draft
      const draftRef = await addDoc(collection(this.firestore, 'drafts'), {
        season: this.newDraftSeason,
        league: this.newDraftLeague,
        rounds: this.newDraftRounds,
        status: 'not_started',
        draftClassId,
        createdAt: new Date()
      });
      
      // Close modal
      this.showCreateDraftModal = false;
      
      // Reload drafts
      await this.loadDrafts();
      
      // Select the newly created draft
      const newDraft = this.drafts.find(d => d.id === draftRef.id);
      if (newDraft) {
        this.selectedDraft = newDraft;
        
        // Open the draft order management modal
        this.openManageDraftOrderModal();
      }
      
      alert(`Draft created successfully for Season ${this.newDraftSeason}!`);
    } catch (error) {
      console.error('Error creating new draft:', error);
      alert('Failed to create draft. Please try again.');
    }
  }
  
  async openManageDraftOrderModal() {
    if (!this.canManageDraft || !this.selectedDraft) return;
    
    // Get teams for the selected league
    this.availableTeams = this.teams.filter(t => (t.league || 'major') === this.selectedDraft!.league);
    
    // Load current draft order
    const orderRef = doc(this.firestore, `drafts/${this.selectedDraft.id}/settings/order`);
    const orderSnap = await getDoc(orderRef);
    
    if (orderSnap.exists()) {
      const orderData = orderSnap.data();
      const teamIds = orderData['teams'] || [];
      
      this.draftOrderTeams = [];
      for (const teamId of teamIds) {
        const team = this.availableTeams.find(t => t.id === teamId);
        if (team) {
          this.draftOrderTeams.push(team);
          // Remove from available teams
          this.availableTeams = this.availableTeams.filter(t => t.id !== teamId);
        }
      }
    } else {
      this.draftOrderTeams = [];
    }
    
    this.showManageDraftOrderModal = true;
  }
  
  addTeamToDraftOrder(team: Team) {
    this.draftOrderTeams.push(team);
    this.availableTeams = this.availableTeams.filter(t => t.id !== team.id);
  }
  
  removeTeamFromDraftOrder(team: Team) {
    this.availableTeams.push(team);
    this.draftOrderTeams = this.draftOrderTeams.filter(t => t.id !== team.id);
  }
  
  moveTeamUp(index: number) {
    if (index <= 0) return;
    const temp = this.draftOrderTeams[index];
    this.draftOrderTeams[index] = this.draftOrderTeams[index - 1];
    this.draftOrderTeams[index - 1] = temp;
  }
  
  moveTeamDown(index: number) {
    if (index >= this.draftOrderTeams.length - 1) return;
    const temp = this.draftOrderTeams[index];
    this.draftOrderTeams[index] = this.draftOrderTeams[index + 1];
    this.draftOrderTeams[index + 1] = temp;
  }
  
  async saveDraftOrder() {
    if (!this.canManageDraft || !this.selectedDraft) return;
    
    try {
      // Save draft order
      const orderRef = doc(this.firestore, `drafts/${this.selectedDraft.id}/settings/order`);
      await setDoc(orderRef, {
        teams: this.draftOrderTeams.map(t => t.id),
        createdAt: new Date()
      });
      
      // Generate draft picks
      await this.generateDraftPicks();
      
      // Close modal and reload draft details
      this.showManageDraftOrderModal = false;
      await this.loadDraftDetails(this.selectedDraft);
      
      alert('Draft order saved successfully!');
    } catch (error) {
      console.error('Error saving draft order:', error);
      alert('Failed to save draft order. Please try again.');
    }
  }
  
  async generateDraftPicks() {
    if (!this.selectedDraft) return;
    
    try {
      // Delete existing picks first
      const existingPicksRef = collection(this.firestore, `drafts/${this.selectedDraft.id}/picks`);
      const existingPicksSnap = await getDocs(existingPicksRef);
      
      const deleteBatch = writeBatch(this.firestore);
      existingPicksSnap.docs.forEach(doc => {
        deleteBatch.delete(doc.ref);
      });
      await deleteBatch.commit();
      
      // Generate new picks
      const batch = writeBatch(this.firestore);
      
      for (let round = 1; round <= this.selectedDraft.rounds; round++) {
        for (let pick = 1; pick <= this.draftOrderTeams.length; pick++) {
          const teamIndex = pick - 1;
          const team = this.draftOrderTeams[teamIndex];
          
          const pickRef = doc(collection(this.firestore, `drafts/${this.selectedDraft.id}/picks`));
          
          batch.set(pickRef, {
            season: this.selectedDraft.season,
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
      console.log(`✅ Generated ${this.selectedDraft.rounds} rounds of draft picks`);
    } catch (error) {
      console.error('Error generating draft picks:', error);
      throw error;
    }
  }
  
  async selectDraft(draft: Draft) {
    this.selectedDraft = draft;
    await this.loadDraftDetails(draft);
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

  // Draft history helper methods
  getUniqueDraftSeasons(): number[] {
    const seasons = [...new Set(this.draftHistory.map(p => p.season))];
    return seasons.sort((a, b) => b - a);
  }

  getPicksForSeason(season: number): DraftPick[] {
    return this.draftHistory.filter(p => p.season === season);
  }
  
  // Helper method to extract index URL from error message
  extractIndexUrl(errorMessage: string): string {
    const match = errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
    return match ? match[0] : this.indexUrl;
  }
  
  getDraftStatusBadgeClass(status: string): string {
    switch (status) {
      case 'not_started': return 'bg-secondary';
      case 'in_progress': return 'bg-warning text-dark';
      case 'completed': return 'bg-success';
      default: return 'bg-secondary';
    }
  }
  
  getDraftStatusText(status: string): string {
    switch (status) {
      case 'not_started': return 'Not Started';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      default: return 'Unknown';
    }
  }
  
  async deleteDraft(draft: Draft) {
    if (!this.canManageDraft || !this.isDeveloper) return;
    
    if (!confirm(`Are you sure you want to delete the Season ${draft.season} draft? This action cannot be undone.`)) {
      return;
    }
    
    try {
      // Delete draft picks
      const picksRef = collection(this.firestore, `drafts/${draft.id}/picks`);
      const picksSnap = await getDocs(picksRef);
      
      const batch = writeBatch(this.firestore);
      picksSnap.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Delete draft order
      const orderRef = doc(this.firestore, `drafts/${draft.id}/settings/order`);
      batch.delete(orderRef);
      
      // Delete draft document
      batch.delete(doc(this.firestore, `drafts/${draft.id}`));
      
      await batch.commit();
      
      // Reload drafts
      await this.loadDrafts();
      
      alert(`Draft for Season ${draft.season} deleted successfully!`);
    } catch (error) {
      console.error('Error deleting draft:', error);
      alert('Failed to delete draft. Please try again.');
    }
  }
}