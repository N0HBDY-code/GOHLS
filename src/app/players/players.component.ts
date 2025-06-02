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
    height: 72, // Default to 6'0"
    weight: 180, // Default weight
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

  private calculateAttributeModifiers(): { [key: string]: number } {
    const heightMod = Math.floor((this.playerForm.height - 72) / 2); // Base height 72 inches (6'0")
    const weightMod = Math.floor((this.playerForm.weight - 180) / 10); // Base weight 180 lbs

    const mods: { [key: string]: number } = {};

    // Height affects
    mods['BALANCE'] = -heightMod; // Taller players have lower balance
    mods['AGILITY'] = -heightMod;
    mods['STRENGTH'] = heightMod;
    mods['ACCEL'] = -heightMod;

    // Weight affects
    mods['SPEED'] = -weightMod;
    mods['BODY CHK'] = weightMod;
    mods['STRENGTH'] = weightMod;
    mods['BALANCE'] = weightMod;
    mods['AGILITY'] = -weightMod;
    mods['ACCEL'] = -weightMod;

    return mods;
  }

  private getArchetypeAttributes(): { [key: string]: number } {
    const baseAttributes: { [key: string]: number } = {};
    
    switch (this.playerForm.archetype) {
      case 'Playmaker':
        return {
          'SPEED': 72, 'BODY CHK': 68, 'ENDUR': 70, 'PK CTRL': 75,
          'PASSING': 75, 'SHT/PSS': 70, 'SLAP PWR': 70, 'SLAP ACC': 72,
          'WRI PWR': 72, 'WRI ACC': 77, 'AGILITY': 72, 'STRENGTH': 68,
          'ACCEL': 72, 'BALANCE': 70, 'FACEOFF': 75, 'DRBLTY': 75,
          'DEKE': 75, 'AGGRE': 65, 'POISE': 70, 'HND EYE': 75,
          'SHT BLK': 65, 'OFF AWR': 75, 'DEF AWR': 70, 'DISCIP': 70,
          'FIGHTING': 65, 'STK CHK': 65
        };

      case 'Sniper':
        return {
          'SPEED': 72, 'BODY CHK': 60, 'ENDUR': 70, 'PK CTRL': 75,
          'PASSING': 70, 'SHT/PSS': 72, 'SLAP PWR': 72, 'SLAP ACC': 72,
          'WRI PWR': 72, 'WRI ACC': 72, 'AGILITY': 72, 'STRENGTH': 60,
          'ACCEL': 72, 'BALANCE': 68, 'FACEOFF': 65, 'DRBLTY': 72,
          'DEKE': 68, 'AGGRE': 65, 'POISE': 75, 'HND EYE': 75,
          'SHT BLK': 64, 'OFF AWR': 72, 'DEF AWR': 65, 'DISCIP': 70,
          'FIGHTING': 55, 'STK CHK': 64
        };

      case '2-Way Forward':
        return {
          'SPEED': 68, 'BODY CHK': 66, 'ENDUR': 66, 'PK CTRL': 66,
          'PASSING': 65, 'SHT/PSS': 66, 'SLAP PWR': 66, 'SLAP ACC': 66,
          'WRI PWR': 66, 'WRI ACC': 66, 'AGILITY': 66, 'STRENGTH': 66,
          'ACCEL': 66, 'BALANCE': 66, 'FACEOFF': 66, 'DRBLTY': 66,
          'DEKE': 66, 'AGGRE': 66, 'POISE': 66, 'HND EYE': 66,
          'SHT BLK': 66, 'OFF AWR': 66, 'DEF AWR': 66, 'DISCIP': 66,
          'FIGHTING': 66, 'STK CHK': 66
        };

      case 'Power Forward':
        return {
          'SPEED': 65, 'BODY CHK': 70, 'ENDUR': 68, 'PK CTRL': 64,
          'PASSING': 64, 'SHT/PSS': 68, 'SLAP PWR': 68, 'SLAP ACC': 64,
          'WRI PWR': 68, 'WRI ACC': 64, 'AGILITY': 65, 'STRENGTH': 70,
          'ACCEL': 65, 'BALANCE': 70, 'FACEOFF': 65, 'DRBLTY': 72,
          'DEKE': 70, 'AGGRE': 66, 'POISE': 64, 'HND EYE': 70,
          'SHT BLK': 70, 'OFF AWR': 68, 'DEF AWR': 66, 'DISCIP': 68,
          'FIGHTING': 70, 'STK CHK': 72
        };

      case 'Enforcer Forward':
        return {
          'SPEED': 62, 'BODY CHK': 75, 'ENDUR': 73, 'PK CTRL': 60,
          'PASSING': 60, 'SHT/PSS': 78, 'SLAP PWR': 74, 'SLAP ACC': 65,
          'WRI PWR': 70, 'WRI ACC': 65, 'AGILITY': 63, 'STRENGTH': 75,
          'ACCEL': 63, 'BALANCE': 73, 'FACEOFF': 60, 'DRBLTY': 66,
          'DEKE': 64, 'AGGRE': 80, 'POISE': 68, 'HND EYE': 65,
          'SHT BLK': 70, 'OFF AWR': 63, 'DEF AWR': 73, 'DISCIP': 68,
          'FIGHTING': 80, 'STK CHK': 75
        };

      case 'Grinder':
        return {
          'SPEED': 64, 'BODY CHK': 72, 'ENDUR': 66, 'PK CTRL': 70,
          'PASSING': 65, 'SHT/PSS': 70, 'SLAP PWR': 70, 'SLAP ACC': 68,
          'WRI PWR': 70, 'WRI ACC': 66, 'AGILITY': 65, 'STRENGTH': 72,
          'ACCEL': 63, 'BALANCE': 68, 'FACEOFF': 70, 'DRBLTY': 66,
          'DEKE': 64, 'AGGRE': 72, 'POISE': 65, 'HND EYE': 67,
          'SHT BLK': 67, 'OFF AWR': 72, 'DEF AWR': 64, 'DISCIP': 70,
          'FIGHTING': 75, 'STK CHK': 75
        };

      // Add other archetypes here...

      default:
        return {};
    }
  }

  private getGoalieAttributes(): { [key: string]: number } {
    return {
      'GLV LOW': 50,
      'GLV HIGH': 50,
      'STK LOW': 50,
      'STK HIGH': 50,
      '5 HOLE': 50,
      'SPEED': 50,
      'AGILITY': 50,
      'CONSIS': 50,
      'PK CHK': 50,
      'ENDUR': 50,
      'BRK AWAY': 50,
      'RBD CTRL': 50,
      'RECOV': 50,
      'POISE': 50,
      'PASSING': 50,
      'ANGLES': 50,
      'PK PL FRQ': 50,
      'AGGRE': 50,
      'DRBLTY': 50,
      'VISION': 50
    };
  }

  async createPlayer() {
    const user = this.auth.currentUser;
    if (!user) return;

    let attributes: { [key: string]: number };
    
    if (this.playerForm.position === 'G') {
      attributes = this.getGoalieAttributes();
    } else {
      attributes = this.getArchetypeAttributes();
      const modifiers = this.calculateAttributeModifiers();
      
      // Apply modifiers to base attributes
      for (const [attr, mod] of Object.entries(modifiers)) {
        if (attributes[attr]) {
          attributes[attr] = Math.max(40, Math.min(99, attributes[attr] + mod));
        }
      }
    }

    // Create the player document
    const playerRef = await addDoc(collection(this.firestore, 'players'), {
      ...this.playerForm,
      userId: user.uid,
      teamId: 'none'
    });

    // Create attributes document
    await setDoc(doc(this.firestore, `players/${playerRef.id}/meta/attributes`), attributes);

    this.hasPlayer = true;
    this.router.navigate(['/player']);
  }
}