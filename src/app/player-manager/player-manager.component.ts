import { Component, inject, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, addDoc, query, where, doc, setDoc, getDoc, updateDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  loading = true;

  trainingType: string = '';
  tempTrainingType: string = '';
  trainingOptions: string[] = [];
  trainingSubmitted = false;
  trainingStatus: 'pending' | 'processed' | null = null;

  secondaryProgress: number = 0;
  existingTrainingId: string | null = null;

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
      await this.checkSecondaryProgress();
      await this.checkExistingTraining();
    }
    this.loading = false;
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
    if (!this.tempTrainingType || !this.player?.id) return;

    const trainingData = {
      training: this.tempTrainingType,
      timestamp: new Date(),
      status: 'pending'
    };

    const trainingCollection = collection(this.firestore, `players/${this.player.id}/progressions`);

    if (this.existingTrainingId) {
      const trainingDoc = doc(this.firestore, `players/${this.player.id}/progressions/${this.existingTrainingId}`);
      await updateDoc(trainingDoc, trainingData);
    } else {
      const docRef = await addDoc(trainingCollection, trainingData);
      this.existingTrainingId = docRef.id;
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
