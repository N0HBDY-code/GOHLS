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

    if (this.playerForm.position === 'G') {
      const mods: { [key: string]: number } = {};

      // Height modifiers
      mods['SPEED'] = -2 * heightMod;
      mods['AGILITY'] = -2 * heightMod;
      mods['PK CTRL'] = -2 * heightMod;
      mods['RECOV'] = heightMod;
      mods['ANGLES'] = 2 * heightMod;
      mods['AGGRE'] = heightMod;
      mods['VISION'] = 2 * heightMod;

      // Weight modifiers
      mods['GLV HIGH'] = -weightMod;
      mods['STK HIGH'] = -weightMod;
      mods['ENDUR'] = -2 * weightMod;
      mods['DRBLTY'] = 2 * weightMod;

      // Combined modifiers (take the more significant impact)
      mods['SPEED'] = Math.min(mods['SPEED'] || 0, -2 * weightMod);
      mods['AGILITY'] = Math.min(mods['AGILITY'] || 0, -weightMod);
      mods['RECOV'] = Math.min(mods['RECOV'] || 0, -2 * weightMod);
      mods['AGGRE'] = Math.max(mods['AGGRE'] || 0, weightMod);

      return mods;
    }

    const mods: { [key: string]: number } = {};

    // Height modifiers
    mods['BALANCE'] = -heightMod;
    mods['AGILITY'] = -heightMod;
    mods['STRENGTH'] = heightMod;
    mods['ACCEL'] = -heightMod;

    // Weight modifiers
    mods['SPEED'] = -weightMod;
    mods['BODY CHK'] = 2 * weightMod;
    mods['STRENGTH'] = Math.max(mods['STRENGTH'] || 0, 2 * weightMod);
    mods['BALANCE'] = Math.max(mods['BALANCE'] || 0, weightMod);
    mods['AGILITY'] = Math.min(mods['AGILITY'] || 0, -weightMod);
    mods['ACCEL'] = Math.min(mods['ACCEL'] || 0, -weightMod);

    return mods;
  }

  private getArchetypeAttributes(): { [key: string]: number } {
    const baseAttributes: { [key: string]: number } = {};
    
    switch (this.playerForm.archetype) {
      case 'Defensive Defense':
        return {
          'SPEED': 64, 'BODY CHK': 85, 'ENDUR': 73, 'PK CTRL': 95,
          'PASSING': 66, 'SHT/PSS': 87, 'SLAP PWR': 66, 'SLAP ACC': 85,
          'WRI PWR': 72, 'WRI ACC': 93, 'AGILITY': 63, 'STRENGTH': 87,
          'ACCEL': 70, 'BALANCE': 93, 'FACEOFF': 63, 'DRBLTY': 87,
          'DEKE': 66, 'AGGRE': 90, 'POISE': 74, 'HND EYE': 95,
          'SHT BLK': 65, 'OFF AWR': 89, 'DEF AWR': 68, 'DISCIP': 92,
          'FIGHTING': 66, 'STK CHK': 75
        };

      case 'Offensive Defense':
        return {
          'SPEED': 70, 'BODY CHK': 65, 'ENDUR': 68, 'PK CTRL': 66,
          'PASSING': 72, 'SHT/PSS': 92, 'SLAP PWR': 70, 'SLAP ACC': 90,
          'WRI PWR': 72, 'WRI ACC': 95, 'AGILITY': 68, 'STRENGTH': 84,
          'ACCEL': 68, 'BALANCE': 94, 'FACEOFF': 68, 'DRBLTY': 85,
          'DEKE': 70, 'AGGRE': 88, 'POISE': 66, 'HND EYE': 80,
          'SHT BLK': 66, 'OFF AWR': 99, 'DEF AWR': 68, 'DISCIP': 88,
          'FIGHTING': 66, 'STK CHK': 70
        };

      case '2-Way Defense':
        return {
          'SPEED': 66, 'BODY CHK': 90, 'ENDUR': 68, 'PK CTRL': 93,
          'PASSING': 66, 'SHT/PSS': 99, 'SLAP PWR': 68, 'SLAP ACC': 90,
          'WRI PWR': 68, 'WRI ACC': 87, 'AGILITY': 66, 'STRENGTH': 90,
          'ACCEL': 66, 'BALANCE': 92, 'FACEOFF': 66, 'DRBLTY': 87,
          'DEKE': 66, 'AGGRE': 99, 'POISE': 66, 'HND EYE': 80,
          'SHT BLK': 68, 'OFF AWR': 91, 'DEF AWR': 67, 'DISCIP': 89,
          'FIGHTING': 70, 'STK CHK': 90
        };

      case 'Enforcer Defense':
        return {
          'SPEED': 62, 'BODY CHK': 86, 'ENDUR': 75, 'PK CTRL': 99,
          'PASSING': 66, 'SHT/PSS': 99, 'SLAP PWR': 60, 'SLAP ACC': 80,
          'WRI PWR': 78, 'WRI ACC': 99, 'AGILITY': 60, 'STRENGTH': 85,
          'ACCEL': 74, 'BALANCE': 95, 'FACEOFF': 60, 'DRBLTY': 85,
          'DEKE': 63, 'AGGRE': 87, 'POISE': 75, 'HND EYE': 59,
          'SHT BLK': 64, 'OFF AWR': 85, 'DEF AWR': 70, 'DISCIP': 90,
          'FIGHTING': 60, 'STK CHK': 78
        };

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

      default:
        return {};
    }
  }

  private getGoalieAttributes(): { [key: string]: number } {
    switch (this.playerForm.archetype) {
      case 'Hybrid':
        return {
          'GLV LOW': 66, 'GLV HIGH': 66, 'STK LOW': 66, 'STK HIGH': 66,
          '5 HOLE': 66, 'SPEED': 68, 'AGILITY': 66, 'CONSIS': 90,
          'PK CTRL': 66, 'ENDUR': 99, 'BRK AWAY': 66, 'RBD CTRL': 92,
          'RECOV': 66, 'POISE': 92, 'PASSING': 66, 'ANGLES': 92,
          'PK PL FRQ': 66, 'AGGRE': 85, 'DRBLTY': 66, 'VISION': 92
        };

      case 'Butterfly':
        return {
          'GLV LOW': 62, 'GLV HIGH': 70, 'STK LOW': 62, 'STK HIGH': 68,
          '5 HOLE': 75, 'SPEED': 98, 'AGILITY': 66, 'CONSIS': 90,
          'PK CTRL': 70, 'ENDUR': 95, 'BRK AWAY': 60, 'RBD CTRL': 97,
          'RECOV': 59, 'POISE': 95, 'PASSING': 64, 'ANGLES': 90,
          'PK PL FRQ': 60, 'AGGRE': 90, 'DRBLTY': 61, 'VISION': 97
        };

      case 'Standup':
        return {
          'GLV LOW': 70, 'GLV HIGH': 62, 'STK LOW': 70, 'STK HIGH': 64,
          '5 HOLE': 60, 'SPEED': 68, 'AGILITY': 66, 'CONSIS': 99,
          'PK CTRL': 75, 'ENDUR': 99, 'BRK AWAY': 63, 'RBD CTRL': 89,
          'RECOV': 70, 'POISE': 96, 'PASSING': 66, 'ANGLES': 92,
          'PK PL FRQ': 70, 'AGGRE': 90, 'DRBLTY': 71, 'VISION': 97
        };

      default:
        return {
          'GLV LOW': 50, 'GLV HIGH': 50, 'STK LOW': 50, 'STK HIGH': 50,
          '5 HOLE': 50, 'SPEED': 50, 'AGILITY': 50, 'CONSIS': 50,
          'PK CTRL': 50, 'ENDUR': 50, 'BRK AWAY': 50, 'RBD CTRL': 50,
          'RECOV': 50, 'POISE': 50, 'PASSING': 50, 'ANGLES': 50,
          'PK PL FRQ': 50, 'AGGRE': 50, 'DRBLTY': 50, 'VISION': 50
        };
    }
  }

  async createPlayer() {
    const user = this.auth.currentUser;
    if (!user) return;

    let attributes: { [key: string]: number };
    
    if (this.playerForm.position === 'G') {
      attributes = this.getGoalieAttributes();
    } else {
      attributes = this.getArchetypeAttributes();
    }

    const modifiers = this.calculateAttributeModifiers();
    
    // Apply modifiers to base attributes
    for (const [attr, mod] of Object.entries(modifiers)) {
      if (attributes[attr]) {
        attributes[attr] = Math.max(40, Math.min(99, attributes[attr] + mod));
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