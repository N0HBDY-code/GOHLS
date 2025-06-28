import { Component, inject, OnInit } from '@angular/core';
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
export class PlayerManagerComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);

  player: any = null;
  teamName: string = '';
  loading = true;

  trainingType: string = '';
  tempTrainingType: string = '';
  trainingOptions: string[] = [];
  trainingSubmitted = false;
  trainingStatus: 'pending' | 'processed' | null = null;

  // Progression control
  progressionsOpen = true;
  currentProgressionWeek = 1;

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

  async ngOnInit() {
    const user = this.auth.currentUser;
    if (!user) return;

    // Load progression settings first
    await this.loadProgressionSettings();

    const playerQuery = query(
      collection(this.firestore, 'players'),
      where('userId', '==', user.uid)
    );
    const snapshot = await getDocs(playerQuery);
    if (!snapshot.empty) {
      this.player = snapshot.docs[0].data();
      this.player.id = snapshot.docs[0].id;
      
      // Check if player is retired
      if (this.player.status === 'retired') {
        this.loading = false;
        return;
      }

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
        }
      }
    }
    this.loading = false;
  }

  async loadProgressionSettings() {
    try {
      const settingsRef = doc(this.firestore, 'progressionSettings/config');
      const snap = await getDoc(settingsRef);

      if (snap.exists()) {
        const data = snap.data();
        this.progressionsOpen = data['open'] ?? true;
        this.currentProgressionWeek = data['week'] ?? 1;
      } else {
        this.progressionsOpen = true;
        this.currentProgressionWeek = 1;
      }
    } catch (error) {
      console.error('Error loading progression settings:', error);
      this.progressionsOpen = true;
      this.currentProgressionWeek = 1;
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
      
      if (data['teamId'] && data['teamId'] !== 'none') {
        const teamRef = doc(this.firestore, `teams/${data['teamId']}`);
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) {
          const teamData = teamSnap.data() as any;
          teamName = `${teamData['city']} ${teamData['mascot']}`;
        }
      }
      
      return {
        id: historyDoc.id,
        ...data,
        teamName,
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
    const currentWeek = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    
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
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const progressRef = collection(this.firestore, `players/${this.player.id}/progressions`);
    const snapshot = await getDocs(progressRef);

    const currentWeekTraining = snapshot.docs.find(doc => {
      const ts = doc.data()['timestamp']?.toDate?.();
      return ts && ts >= weekStart;
    });

    if (currentWeekTraining) {
      const data = currentWeekTraining.data();
      this.trainingType = data['training'];
      this.tempTrainingType = this.trainingType;
      this.trainingStatus = data['status'] || 'pending';
      this.trainingSubmitted = true;
      this.existingTrainingId = currentWeekTraining.id;
    }
  }

  async submitTraining() {
    if (!this.tempTrainingType || !this.player?.id || !this.player?.teamId) return;

    // Check if progressions are open
    if (!this.progressionsOpen) {
      alert('Training submissions are currently closed. Please wait for the next progression period to open.');
      return;
    }
  
    const trainingData = {
      training: this.tempTrainingType,
      timestamp: new Date(),
      status: 'pending'
    };
  
    const playerProgressionRef = collection(this.firestore, `players/${this.player.id}/progressions`);
    const teamProgressionRef = collection(this.firestore, `teams/${this.player.teamId}/roster/${this.player.id}/progression`);
  
    if (this.existingTrainingId) {
      // Update existing training
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
          joinDate: entry.timestamp,
          action: entry.action
        });
      }
    });

    return Array.from(teams.values()).sort((a, b) => b.joinDate.getTime() - a.joinDate.getTime());
  }
}