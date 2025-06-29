import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Firestore, collection, getDocs, addDoc, query, where, doc, setDoc, getDoc, updateDoc, orderBy } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { serverTimestamp } from '@angular/fire/firestore';
import { Router } from '@angular/router';

@Component({
  selector: 'app-player-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './player-manager.component.html',
  styleUrls: ['./player-manager.component.css']
})
export class PlayerManagerComponent implements OnInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);

  player: any = null;
  pendingPlayer: any = null;
  teamName: string = '';
  teamLogo: string = '';
  loading = true;
  isPendingPlayer = false;

  trainingType: string = '';
  tempTrainingType: string = '';
  trainingOptions: string[] = [];
  trainingSubmitted = false;
  trainingStatus: 'pending' | 'processed' | null = null;
  trainingProcessed = false; // New flag to track if training is processed

  // Progression control
  progressionsOpen = true;
  currentProgressionWeek = 1;
  hasSubmittedThisWeek = false;

  secondaryProgress: number = 0;
  existingTrainingId: string | null = null;

  // Player attributes
  playerAttributes: Record<string, number> = {};
  
  // Attribute display order
  skaterAttributeOrder = [
    'SPEED', 'BODY CHK', 'ENDUR', 'PK CTRL', 'PASSING', 'SHT/PSS',
    'SLAP PWR', 'SLAP ACC', 'WRI PWR', 'WRI ACC', 'AGILITY', 'STRENGTH',
    'ACCEL', 'BALANCE', 'FACEOFF', 'DRBLTY', 'DEKE', 'AGGRE', 'POISE',
    'HND EYE', 'SHT BLK', 'OFF AWR', 'DEF AWR', 'DISCIP', 'FIGHTING',
    'STK CHK'
  ];

  goalieAttributeOrder = [
    'GLV LOW', 'GLV HIGH', 'STK LOW', 'STK HIGH', '5 HOLE', 'SPEED',
    'AGILITY', 'CONSIS', 'PK CTRL', 'ENDUR', 'BRK AWAY', 'RBD CTRL',
    'RECOV', 'POISE', 'PASSING', 'ANGLES', 'PK PL FRQ', 'AGGRE',
    'DRBLTY', 'VISION'
  ];

  // Training impact mapping
  private trainingMap: Record<string, string[]> = {
    'Speed Skating': ['SPEED', 'ACCEL', 'AGILITY'],
    'Distance Skating': ['ENDUR', 'BALANCE', 'DRBLTY'],
    'Stick Handling': ['PK CTRL', 'DEKE', 'HND EYE'],
    'MMA': ['BODY CHK', 'STRENGTH', 'AGGRE', 'FIGHTING'],
    'Marksmanship': ['WRI PWR', 'SLAP PWR', 'PASSING'],
    'Hit the Targets': ['WRI ACC', 'SLAP ACC', 'POISE'],
    'Study Film': ['OFF AWR', 'DEF AWR', 'DISCIP'],
    'Special Teams': ['STK CHK', 'SHT BLK', 'FACEOFF'],
    'Learn Secondary Position': [], // No immediate attribute impact
    'Shots High': ['GLV HIGH', 'STK HIGH', 'VISION'],
    'Shots Low': ['GLV LOW', 'STK LOW', '5 HOLE'],
    'Side to Sides': ['SPEED', 'AGILITY', 'POISE'],
    'Puck Skills': ['PK CTRL', 'PASSING', 'PK PL FRQ'],
    'Laps in Pads': ['ENDUR', 'DRBLTY', 'AGGRE'],
    'Positioning': ['BRK AWAY', 'ANGLES'],
    'Under Pressure': ['RBD CTRL', 'RECOV']
  };

  // History data
  playerHistory: any[] = [];
  gameStats: any[] = [];
  trainingHistory: any[] = [];
  currentView: 'overview' | 'history' | 'stats' | 'trainings' = 'overview';
  showRetireModal = false;
  retireConfirmation = '';

  // Week change listener
  private weekChangeListener?: () => void;

  async ngOnInit() {
    const user = this.auth.currentUser;
    if (!user) {
      this.loading = false;
      return;
    }

    console.log('PlayerManager: Initializing for user:', user.uid);

    // Set up week change listener
    this.weekChangeListener = () => {
      console.log('🔄 Week change detected, refreshing progression settings...');
      this.loadProgressionSettings();
    };
    window.addEventListener('weekChanged', this.weekChangeListener);

    // Load progression settings first
    await this.loadProgressionSettings();

    // First check for active player
    const playerQuery = query(
      collection(this.firestore, 'players'),
      where('userId', '==', user.uid),
      where('status', '==', 'active')
    );
    const playerSnapshot = await getDocs(playerQuery);
    
    if (!playerSnapshot.empty) {
      // Active player found
      console.log('PlayerManager: Found active player');
      this.player = playerSnapshot.docs[0].data();
      this.player.id = playerSnapshot.docs[0].id;
      this.isPendingPlayer = false;
      
      this.setTrainingOptions(this.player.position);
      await this.loadPlayerAttributes();
      await this.loadPlayerHistory();
      await this.loadGameStats();
      await this.loadTrainingHistory();
      await this.checkSecondaryProgress();
      await this.checkExistingTraining();

      if (this.player.teamId && this.player.teamId !== 'none') {
        const teamRef = doc(this.firestore, `teams/${this.player.teamId}`);
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) {
          const teamData = teamSnap.data();
          const city = teamData['city'] || '';
          const mascot = teamData['mascot'] || '';
          this.teamName = `${city} ${mascot}`.trim();
          this.teamLogo = teamData['logoUrl'] || '';
        }
      }
    } else {
      // No active player, check for pending player
      console.log('PlayerManager: No active player, checking for pending...');
      const pendingQuery = query(
        collection(this.firestore, 'pendingPlayers'),
        where('userId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      
      if (!pendingSnapshot.empty) {
        console.log('PlayerManager: Found pending player');
        this.pendingPlayer = pendingSnapshot.docs[0].data();
        this.pendingPlayer.id = pendingSnapshot.docs[0].id;
        this.isPendingPlayer = true;
      } else {
        console.log('PlayerManager: No pending player found either');
      }
    }
    
    this.loading = false;
  }

  ngOnDestroy() {
    // Clean up event listeners
    if (this.weekChangeListener) {
      window.removeEventListener('weekChanged', this.weekChangeListener);
    }
  }

  // Method to get overall rating color based on value
  getOverallColor(overall: number): string {
    // Clamp the value between 50 and 99
    const clampedOverall = Math.max(50, Math.min(99, overall));
    
    // Calculate the percentage from 50 to 99 (0% to 100%)
    const percentage = (clampedOverall - 50) / (99 - 50);
    
    // Interpolate between red (RGB: 220, 53, 69) and green (RGB: 40, 167, 69)
    const red = Math.round(220 - (220 - 40) * percentage);
    const green = Math.round(53 + (167 - 53) * percentage);
    const blue = Math.round(69);
    
    return `rgb(${red}, ${green}, ${blue})`;
  }

  // Method to get overall progress percentage for the circular progress
  getOverallProgress(overall: number): number {
    // Convert overall rating (50-99) to percentage (0-100) for the circle
    const clampedOverall = Math.max(50, Math.min(99, overall));
    return ((clampedOverall - 50) / (99 - 50)) * 100;
  }

  async loadProgressionSettings() {
    try {
      const settingsRef = doc(this.firestore, 'progressionSettings/config');
      const snap = await getDoc(settingsRef);

      const previousWeek = this.currentProgressionWeek;

      if (snap.exists()) {
        const data = snap.data();
        this.progressionsOpen = data['open'] ?? true;
        this.currentProgressionWeek = data['week'] ?? 1;
      } else {
        this.progressionsOpen = true;
        this.currentProgressionWeek = 1;
      }

      // Check if week has changed
      if (previousWeek !== this.currentProgressionWeek && previousWeek !== 0) {
        console.log(`📅 Week changed from ${previousWeek} to ${this.currentProgressionWeek}`);
        await this.handleWeekChange();
      }

      // Check if player has submitted for current week
      if (this.player?.id) {
        await this.checkCurrentWeekSubmission();
      }

    } catch (error) {
      console.error('Error loading progression settings:', error);
      this.progressionsOpen = true;
      this.currentProgressionWeek = 1;
    }
  }

  async handleWeekChange() {
    console.log('🔄 Handling week change...');
    
    // Clear current training selection
    this.tempTrainingType = '';
    this.trainingType = '';
    this.trainingSubmitted = false;
    this.trainingStatus = null;
    this.trainingProcessed = false;
    this.existingTrainingId = null;
    this.hasSubmittedThisWeek = false;

    console.log('✅ Training selection cleared for new week');
  }

  async checkCurrentWeekSubmission() {
    if (!this.player?.id) return;

    try {
      // Check if player has already submitted training for current week
      const progressRef = collection(this.firestore, `players/${this.player.id}/progressions`);
      const q = query(
        progressRef,
        where('week', '==', this.currentProgressionWeek),
        where('season', '==', new Date().getFullYear())
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const submissionData = snapshot.docs[0].data();
        this.hasSubmittedThisWeek = true;
        this.trainingType = submissionData['training'];
        this.tempTrainingType = this.trainingType;
        this.trainingStatus = submissionData['status'] || 'pending';
        this.trainingProcessed = this.trainingStatus === 'processed'; // Set processed flag
        this.trainingSubmitted = true;
        this.existingTrainingId = snapshot.docs[0].id;
        
        console.log(`📝 Found existing submission for week ${this.currentProgressionWeek}:`, this.trainingType, 'Status:', this.trainingStatus);
      } else {
        this.hasSubmittedThisWeek = false;
        this.trainingSubmitted = false;
        this.trainingProcessed = false;
        console.log(`📝 No submission found for week ${this.currentProgressionWeek}`);
      }
    } catch (error) {
      console.error('Error checking current week submission:', error);
    }
  }

  async loadPlayerAttributes() {
    if (!this.player?.id) return;
    
    const attributesRef = doc(this.firestore, `players/${this.player.id}/meta/attributes`);
    const attributesSnap = await getDoc(attributesRef);
    
    if (attributesSnap.exists()) {
      this.playerAttributes = attributesSnap.data() as Record<string, number>;
    }
  }

  async loadPlayerHistory() {
    if (!this.player?.id) return;

    const historyRef = collection(this.firestore, `players/${this.player.id}/history`);
    const historyQuery = query(historyRef, orderBy('timestamp', 'desc'));
    const historySnap = await getDocs(historyQuery);
    
    this.playerHistory = await Promise.all(historySnap.docs.map(async (historyDoc) => {
      const data = historyDoc.data();
      let teamName = 'Unknown Team';
      let teamLogo = '';
      
      if (data['teamId'] && data['teamId'] !== 'none') {
        const teamRef = doc(this.firestore, `teams/${data['teamId']}`);
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) {
          const teamData = teamSnap.data() as any;
          teamName = `${teamData['city']} ${teamData['mascot']}`;
          teamLogo = teamData['logoUrl'] || '';
        }
      }
      
      return {
        id: historyDoc.id,
        ...data,
        teamName,
        teamLogo,
        timestamp: data['timestamp']?.toDate?.() || new Date(data['timestamp'])
      };
    }));
  }

  async loadGameStats() {
    if (!this.player?.id) return;

    this.gameStats = [];
    
    // Get all teams to search through their games
    const teamsRef = collection(this.firestore, 'teams');
    const teamsSnap = await getDocs(teamsRef);
    
    const uniqueGames = new Map<string, any>();
    
    for (const teamDoc of teamsSnap.docs) {
      const teamId = teamDoc.id;
      const teamData = teamDoc.data();
      const teamName = `${teamData['city']} ${teamData['mascot']}`;
      
      // Check team's games for this player's stats
      const gamesRef = collection(this.firestore, `teams/${teamId}/games`);
      const gamesSnap = await getDocs(gamesRef);
      
      for (const gameDoc of gamesSnap.docs) {
        const gameData = gameDoc.data();
        
        // Check if this player has stats in this game
        const homePlayerStats = gameData['homePlayerStats']?.[this.player.id];
        const awayPlayerStats = gameData['awayPlayerStats']?.[this.player.id];
        
        let playerStats = null;
        let isHome = false;
        let playerTeamName = teamName;
        
        if (homePlayerStats && gameData['homeTeamId'] === teamId) {
          playerStats = homePlayerStats;
          isHome = true;
        } else if (awayPlayerStats && gameData['awayTeamId'] === teamId) {
          playerStats = awayPlayerStats;
          isHome = false;
        }
        
        if (playerStats) {
          // Get opponent information
          const opponentTeamId = isHome ? gameData['awayTeamId'] : gameData['homeTeamId'];
          let opponent = 'Unknown Opponent';
          
          if (opponentTeamId) {
            const opponentRef = doc(this.firestore, `teams/${opponentTeamId}`);
            const opponentSnap = await getDoc(opponentRef);
            if (opponentSnap.exists()) {
              const opponentData = opponentSnap.data();
              opponent = `${opponentData['city']} ${opponentData['mascot']}`;
            }
          }
          
          // Create unique key using game date, teams, and week/day to avoid duplicates
          const gameKey = `${gameData['week']}-${gameData['day']}-${gameData['homeTeamId']}-${gameData['awayTeamId']}`;
          
          if (!uniqueGames.has(gameKey)) {
            uniqueGames.set(gameKey, {
              gameId: gameDoc.id,
              teamName: playerTeamName,
              opponent,
              date: gameData['date']?.toDate?.() || new Date(),
              week: gameData['week'],
              day: gameData['day'],
              isHome,
              goals: playerStats.goals || 0,
              assists: playerStats.assists || 0,
              plusMinus: playerStats.plusMinus || 0,
              shots: playerStats.shots || 0,
              pim: playerStats.pim || 0,
              hits: playerStats.hits || 0,
              ppg: playerStats.ppg || 0,
              shg: playerStats.shg || 0,
              fot: playerStats.fot || 0,
              fow: playerStats.fow || 0
            });
          }
        }
      }
    }
    
    // Convert Map to array and sort by date descending
    this.gameStats = Array.from(uniqueGames.values())
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async loadTrainingHistory() {
    if (!this.player?.id) return;

    const trainingRef = collection(this.firestore, `players/${this.player.id}/progressions`);
    const trainingQuery = query(trainingRef, orderBy('timestamp', 'desc'));
    const trainingSnap = await getDocs(trainingQuery);
    
    this.trainingHistory = trainingSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data()['timestamp']?.toDate?.() || new Date(doc.data()['timestamp'])
    }));
  }

  setTrainingOptions(position: string) {
    if (position === 'G') {
      this.trainingOptions = [
        'Shots High', 'Shots Low', 'Side to Sides', 'Puck Skills',
        'Laps in Pads', 'Positioning', 'Under Pressure'
      ];
    } else {
      this.trainingOptions = [
        'Speed Skating', 'Distance Skating', 'Stick Handling', 'MMA',
        'Marksmanship', 'Hit the Targets', 'Study Film', 'Special Teams'
      ];
      if (position !== 'D') {
        this.trainingOptions.push('Learn Secondary Position');
      }
    }
  }

  onTrainingChange() {
    // This will trigger the template to update the visual indicators
  }

  isAttributeAffected(attribute: string): boolean {
    if (!this.tempTrainingType) return false;
    const affectedAttributes = this.trainingMap[this.tempTrainingType] || [];
    return affectedAttributes.includes(attribute);
  }

  getAttributeDelta(): number {
    if (!this.player?.age) return 0;
    
    const age = this.player.age;
    const currentWeek = this.currentProgressionWeek;
    
    if (age <= 26) return currentWeek <= 5 ? 3 : 2;
    if (age <= 29) return 1;
    if (age === 30) return 1;
    if (age === 31) return -1;
    if (age === 32) return -2;
    if (age === 33) return -2;
    return -3;
  }

  async checkSecondaryProgress() {
    const progressRef = collection(this.firestore, `players/${this.player.id}/progressions`);
    const snapshot = await getDocs(progressRef);
    this.secondaryProgress = snapshot.docs.filter(doc => doc.data()['training'] === 'Learn Secondary Position').length;
  }

  async checkExistingTraining() {
    // This is now handled by checkCurrentWeekSubmission
    await this.checkCurrentWeekSubmission();
  }

  // Check if training can be edited
  canEditTraining(): boolean {
    return !this.trainingProcessed && this.progressionsOpen;
  }

  async submitTraining() {
    if (!this.tempTrainingType || !this.player?.id || !this.player?.teamId) return;

    // Check if progressions are open
    if (!this.progressionsOpen) {
      alert('Training submissions are currently closed. Please wait for the next progression period to open.');
      return;
    }

    // Check if training has been processed (cannot edit processed training)
    if (this.trainingProcessed) {
      alert('Your training has already been processed and cannot be modified. Please wait for the next week.');
      return;
    }

    // Check if already submitted for this week
    if (this.hasSubmittedThisWeek && !this.existingTrainingId) {
      alert(`You have already submitted training for Week ${this.currentProgressionWeek}. Please wait for the next week.`);
      return;
    }
  
    const currentSeason = new Date().getFullYear();
    const trainingData = {
      training: this.tempTrainingType,
      timestamp: new Date(),
      status: 'pending',
      week: this.currentProgressionWeek,
      season: currentSeason
    };
  
    const playerProgressionRef = collection(this.firestore, `players/${this.player.id}/progressions`);
    const teamProgressionRef = collection(this.firestore, `teams/${this.player.teamId}/roster/${this.player.id}/progression`);
  
    if (this.existingTrainingId) {
      // Update existing training (only if not processed)
      if (this.trainingProcessed) {
        alert('Your training has already been processed and cannot be modified.');
        return;
      }
      
      const trainingDoc = doc(this.firestore, `players/${this.player.id}/progressions/${this.existingTrainingId}`);
      await updateDoc(trainingDoc, trainingData);
      
      const teamDoc = doc(this.firestore, `teams/${this.player.teamId}/roster/${this.player.id}/progression/${this.existingTrainingId}`);
      await setDoc(teamDoc, trainingData); // overwrite or create in team view
    } else {
      // Add new training
      const docRef = await addDoc(playerProgressionRef, trainingData);
      this.existingTrainingId = docRef.id;
  
      const teamDoc = doc(this.firestore, `teams/${this.player.teamId}/roster/${this.player.id}/progression/${docRef.id}`);
      await setDoc(teamDoc, trainingData);
    }
  
    this.trainingType = this.tempTrainingType;
    this.trainingStatus = 'pending';
    this.trainingProcessed = false; // Reset processed flag since we just submitted/updated
    this.hasSubmittedThisWeek = true;
  
    if (this.trainingType === 'Learn Secondary Position') {
      this.secondaryProgress++;
      if (this.secondaryProgress >= 3) {
        alert('You have successfully learned your secondary position!');
      }
    }
  
    this.trainingSubmitted = true;
    await this.loadTrainingHistory();
  }

  async retirePlayer() {
    if (this.retireConfirmation !== 'RETIRE') {
      alert('Please type "RETIRE" to confirm retirement');
      return;
    }

    if (!this.player?.id) return;

    try {
      // Add retirement to player history
      const historyRef = collection(this.firestore, `players/${this.player.id}/history`);
      await addDoc(historyRef, {
        action: 'retired',
        teamId: this.player.teamId,
        timestamp: new Date(),
        details: 'Player announced retirement from professional hockey'
      });

      // Update player status
      const playerRef = doc(this.firestore, `players/${this.player.id}`);
      await updateDoc(playerRef, {
        status: 'retired',
        retiredDate: new Date(),
        teamId: 'retired'
      });

      // Remove from team roster if on a team
      if (this.player.teamId && this.player.teamId !== 'none') {
        const rosterRef = doc(this.firestore, `teams/${this.player.teamId}/roster/${this.player.id}`);
        await updateDoc(rosterRef, {
          status: 'retired',
          retiredDate: new Date()
        });
      }

      this.showRetireModal = false;
      this.player.status = 'retired';
      
      // Emit an event to parent component to refresh status
      window.dispatchEvent(new CustomEvent('playerRetired'));
      
      alert('Your player has been retired. Thank you for your service to the league!');
    } catch (error) {
      console.error('Error retiring player:', error);
      alert('Failed to retire player. Please try again.');
    }
  }

  getTotalStats() {
    return this.gameStats.reduce((totals, game) => {
      totals.games += 1;
      totals.goals += game.goals || 0;
      totals.assists += game.assists || 0;
      totals.points += (game.goals || 0) + (game.assists || 0);
      totals.pim += game.pim || 0;
      totals.hits += game.hits || 0;
      totals.shots += game.shots || 0;
      return totals;
    }, { games: 0, goals: 0, assists: 0, points: 0, pim: 0, hits: 0, shots: 0 });
  }

  getTeamHistory() {
    const teams = new Map();
    
    this.playerHistory.forEach(entry => {
      if (entry.action === 'signed' || entry.action === 'traded') {
        teams.set(entry.teamId, {
          teamName: entry.teamName,
          teamLogo: entry.teamLogo,
          joinDate: entry.timestamp,
          action: entry.action
        });
      }
    });

    return Array.from(teams.values()).sort((a, b) => b.joinDate.getTime() - a.joinDate.getTime());
  }
}