import { Component, inject, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, addDoc, query, where, doc, setDoc, getDoc, updateDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { serverTimestamp } from '@angular/fire/firestore';

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

  player: any = null;
  teamName: string = '';
  loading = true;

  trainingType: string = '';
  tempTrainingType: string = '';
  trainingOptions: string[] = [];
  trainingSubmitted = false;
  trainingStatus: 'pending' | 'processed' | null = null;

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

  async ngOnInit() {
    const user = this.auth.currentUser;
    if (!user) return;

    const playerQuery = query(
      collection(this.firestore, 'players'),
      where('userId', '==', user.uid)
    );
    const snapshot = await getDocs(playerQuery);
    if (!snapshot.empty) {
      this.player = snapshot.docs[0].data();
      this.player.id = snapshot.docs[0].id;
      this.setTrainingOptions(this.player.position);
      await this.loadPlayerAttributes();
      await this.checkSecondaryProgress();
      await this.checkExistingTraining();

      if (this.player.teamId) {
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

  async loadPlayerAttributes() {
    if (!this.player?.id) return;
    
    const attributesRef = doc(this.firestore, `players/${this.player.id}/meta/attributes`);
    const attributesSnap = await getDoc(attributesRef);
    
    if (attributesSnap.exists()) {
      this.playerAttributes = attributesSnap.data() as Record<string, number>;
    }
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
  }
}