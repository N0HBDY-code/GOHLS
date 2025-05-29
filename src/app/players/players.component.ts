import { Component, inject, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, addDoc, query, where, doc, setDoc } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlayerManagerComponent } from '../player-manager/player-manager.component';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, FormsModule, PlayerManagerComponent],
  templateUrl: './players.component.html',
  styleUrls: ['./players.component.css']
})
export class PlayersComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);

  hasPlayer = false;
  loading = true;

  filteredArchetypes: string[] = [];

  playerForm = {
    firstName: '',
    lastName: '',
    gamertag: '',
    position: '',
    archetype: '',
    jerseyNumber: 0,
    handedness: '',
    height: '',
    weight: '',
    fight: '',
    origin: '',
    hair: '',
    beard: '',
    tape: '',
    ethnicity: '',
    twitch: '',
    referral: '',
    invitedBy: '',
    age: 19 
  };

  async ngOnInit() {
    const user = this.auth.currentUser;
    if (!user) return;

    const playerQuery = query(
      collection(this.firestore, 'players'),
      where('userId', '==', user.uid)
    );
    const snapshot = await getDocs(playerQuery);
    this.hasPlayer = !snapshot.empty;
    this.loading = false;
  }

  onPositionChange() {
    const position = this.playerForm.position;
    if (['LW', 'C', 'RW'].includes(position)) {
      this.filteredArchetypes = [
        'Playmaker',
        'Sniper',
        '2-Way Forward',
        'Power Forward',
        'Enforcer Forward',
        'Grinder'
      ];
    } else if (position === 'D') {
      this.filteredArchetypes = [
        'Defensive Defense',
        'Offensive Defense',
        '2-Way Defense',
        'Enforcer Defense'
      ];
    } else if (position === 'G') {
      this.filteredArchetypes = ['Hybrid', 'Butterfly', 'Standup'];
    } else {
      this.filteredArchetypes = [];
    }

    this.playerForm.archetype = '';
  }

  async createPlayer() {
    const user = this.auth.currentUser;
    if (!user) return;

    // Create the player document
    const playerRef = await addDoc(collection(this.firestore, 'players'), {
      ...this.playerForm,
      userId: user.uid,
      teamId: 'none'
    });

    // Create default attributes based on position
    const defaultAttributes = this.getDefaultAttributes(this.playerForm.position);
    await setDoc(doc(this.firestore, `players/${playerRef.id}/meta/attributes`), defaultAttributes);

    this.hasPlayer = true;
    this.router.navigate(['/player']);
  }

  private getDefaultAttributes(position: string): Record<string, number> {
    if (position === 'G') {
      return {
        'GLV LOW': 40,
        'GLV HIGH': 40,
        'STK LOW': 40,
        'STK HIGH': 40,
        '5 HOLE': 40,
        'SPEED': 40,
        'AGILITY': 40,
        'CONSIS': 40,
        'PK CHK': 40,
        'ENDUR': 40,
        'BRK AWAY': 40,
        'RBD CTRL': 40,
        'RECOV': 40,
        'POISE': 40,
        'PASSING': 40,
        'ANGLES': 40,
        'PK PL FRQ': 40,
        'AGGRE': 40,
        'DRBLTY': 40,
        'VISION': 40
      };
    } else {
      return {
        'SPEED': 40,
        'BODY CHK': 40,
        'ENDUR': 40,
        'PK CTRL': 40,
        'PASSING': 40,
        'SHT/PSS': 40,
        'SLAP PWR': 40,
        'SLAP ACC': 40,
        'WRI PWR': 40,
        'WRI ACC': 40,
        'AGILITY': 40,
        'STRENGTH': 40,
        'ACCEL': 40,
        'BALANCE': 40,
        'FACEOFF': 40,
        'DRBLTY': 40,
        'DEKE': 40,
        'AGGRE': 40,
        'POISE': 40,
        'HND EYE': 40,
        'SHT BLK': 40,
        'OFF AWR': 40,
        'DEF AWR': 40,
        'DISCIP': 40,
        'FIGHTING': 40,
        'STK CHK': 40
      };
    }
  }
}