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

  hasActivePlayer = false;
  hasRetiredPlayer = false;
  loading = true;
  retiredPlayerName = '';
  showCreateForm = false;

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
    
    if (!snapshot.empty) {
      const playerData = snapshot.docs[0].data();
      if (playerData['status'] === 'retired') {
        this.hasRetiredPlayer = true;
        this.retiredPlayerName = `${playerData['firstName']} ${playerData['lastName']}`;
        this.hasActivePlayer = false;
        this.showCreateForm = false;
      } else {
        this.hasActivePlayer = true;
        this.hasRetiredPlayer = false;
        this.showCreateForm = false;
      }
    } else {
      this.hasActivePlayer = false;
      this.hasRetiredPlayer = false;
      this.showCreateForm = true;
    }
    
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

  private getBaseAttributes(position: string, archetype: string): { [key: string]: number } {
    if (position === 'G') {
      // Goalie base attributes
      return {
        'GLV LOW': 66, 'GLV HIGH': 66, 'STK LOW': 66, 'STK HIGH': 66,
        '5 HOLE': 66, 'SPEED': 68, 'AGILITY': 66, 'CONSIS': 90,
        'PK CTRL': 66, 'ENDUR': 99, 'BRK AWAY': 66, 'RBD CTRL': 92,
        'RECOV': 66, 'POISE': 92, 'PASSING': 66, 'ANGLES': 92,
        'PK PL FRQ': 66, 'AGGRE': 85, 'DRBLTY': 66, 'VISION': 92
      };
    }

    // Forward/Defense base attributes based on archetype
    const baseAttributes: { [key: string]: number } = {};
    
    // Base values for all skaters (from template)
    const skaterBase = {
      'SPEED': 66, 'BODY CHK': 66, 'ENDUR': 66, 'PK CTRL': 66,
      'PASSING': 66, 'SHT/PSS': 66, 'SLAP PWR': 66, 'SLAP ACC': 66,
      'WRI PWR': 66, 'WRI ACC': 66, 'AGILITY': 66, 'STRENGTH': 66,
      'ACCEL': 66, 'BALANCE': 66, 'FACEOFF': 66, 'DRBLTY': 66,
      'DEKE': 66, 'AGGRE': 66, 'POISE': 66, 'HND EYE': 66,
      'SHT BLK': 66, 'OFF AWR': 66, 'DEF AWR': 66, 'DISCIP': 66,
      'FIGHTING': 66, 'STK CHK': 66
    };

    // Apply archetype modifiers to base values
    switch (archetype) {
      case 'Playmaker':
        return {
          ...skaterBase,
          'SPEED': 72, 'PASSING': 75, 'WRI ACC': 77, 'AGILITY': 72,
          'ACCEL': 72, 'FACEOFF': 75, 'DRBLTY': 75, 'DEKE': 75,
          'HND EYE': 75, 'OFF AWR': 75, 'POISE': 70, 'BODY CHK': 68,
          'STRENGTH': 68, 'AGGRE': 65, 'SHT BLK': 65, 'STK CHK': 65,
          'FIGHTING': 65, 'ENDUR': 70, 'BALANCE': 70
        };

      case 'Sniper':
        return {
          ...skaterBase,
          'SPEED': 72, 'SLAP PWR': 72, 'SLAP ACC': 72, 'WRI PWR': 72,
          'WRI ACC': 72, 'AGILITY': 72, 'ACCEL': 72, 'DRBLTY': 72,
          'POISE': 75, 'HND EYE': 75, 'OFF AWR': 72, 'SHT/PSS': 72,
          'PK CTRL': 75, 'PASSING': 70, 'BODY CHK': 60, 'STRENGTH': 60,
          'BALANCE': 68, 'FACEOFF': 65, 'AGGRE': 65, 'DEF AWR': 65,
          'STK CHK': 64, 'SHT BLK': 64, 'FIGHTING': 55, 'ENDUR': 70
        };

      case '2-Way Forward':
        return {
          ...skaterBase,
          'SPEED': 68, 'ENDUR': 66, 'PASSING': 65
        };

      case 'Power Forward':
        return {
          ...skaterBase,
          'SPEED': 65, 'BODY CHK': 70, 'ENDUR': 68, 'PK CTRL': 64,
          'PASSING': 64, 'SHT/PSS': 68, 'SLAP PWR': 68, 'SLAP ACC': 64,
          'WRI PWR': 68, 'WRI ACC': 64, 'AGILITY': 65, 'STRENGTH': 70,
          'ACCEL': 65, 'BALANCE': 70, 'FACEOFF': 65, 'DRBLTY': 72,
          'DEKE': 70, 'POISE': 64, 'HND EYE': 70, 'SHT BLK': 70,
          'OFF AWR': 68, 'DEF AWR': 66, 'DISCIP': 68, 'FIGHTING': 70,
          'STK CHK': 72, 'AGGRE': 66
        };

      case 'Enforcer Forward':
        return {
          ...skaterBase,
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
          ...skaterBase,
          'SPEED': 64, 'BODY CHK': 72, 'ENDUR': 66, 'PK CTRL': 70,
          'PASSING': 65, 'SHT/PSS': 70, 'SLAP PWR': 70, 'SLAP ACC': 68,
          'WRI PWR': 70, 'WRI ACC': 66, 'AGILITY': 65, 'STRENGTH': 72,
          'ACCEL': 63, 'BALANCE': 68, 'FACEOFF': 70, 'DRBLTY': 66,
          'DEKE': 64, 'AGGRE': 72, 'POISE': 65, 'HND EYE': 67,
          'SHT BLK': 67, 'OFF AWR': 72, 'DEF AWR': 64, 'DISCIP': 70,
          'FIGHTING': 75, 'STK CHK': 75
        };

      case 'Defensive Defense':
        return {
          ...skaterBase,
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
          ...skaterBase,
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
          ...skaterBase,
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
          ...skaterBase,
          'SPEED': 62, 'BODY CHK': 86, 'ENDUR': 75, 'PK CTRL': 99,
          'PASSING': 66, 'SHT/PSS': 99, 'SLAP PWR': 60, 'SLAP ACC': 80,
          'WRI PWR': 78, 'WRI ACC': 99, 'AGILITY': 60, 'STRENGTH': 85,
          'ACCEL': 74, 'BALANCE': 95, 'FACEOFF': 60, 'DRBLTY': 85,
          'DEKE': 63, 'AGGRE': 87, 'POISE': 75, 'HND EYE': 59,
          'SHT BLK': 64, 'OFF AWR': 85, 'DEF AWR': 70, 'DISCIP': 90,
          'FIGHTING': 60, 'STK CHK': 78
        };

      default:
        return skaterBase;
    }
  }

  private calculateHeightWeightModifiers(): { [key: string]: number } {
    const heightMod = Math.floor((this.playerForm.height - 72) / 2); // Base height 72 inches (6'0")
    const weightMod = Math.floor((this.playerForm.weight - 180) / 10); // Base weight 180 lbs

    if (this.playerForm.position === 'G') {
      const mods: { [key: string]: number } = {};

      // Height modifiers for goalies
      mods['SPEED'] = -2 * heightMod;
      mods['AGILITY'] = -2 * heightMod;
      mods['PK CTRL'] = -2 * heightMod;
      mods['RECOV'] = heightMod;
      mods['ANGLES'] = 2 * heightMod;
      mods['AGGRE'] = heightMod;
      mods['VISION'] = 2 * heightMod;

      // Weight modifiers for goalies
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

    // Skater modifiers
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

  async createPlayer() {
    const user = this.auth.currentUser;
    if (!user) return;

    // Get base attributes for the archetype
    const baseAttributes = this.getBaseAttributes(this.playerForm.position, this.playerForm.archetype);
    
    // Calculate height/weight modifiers
    const modifiers = this.calculateHeightWeightModifiers();
    
    // Apply modifiers to base attributes
    const finalAttributes: { [key: string]: number } = { ...baseAttributes };
    
    for (const [attr, mod] of Object.entries(modifiers)) {
      if (finalAttributes[attr] !== undefined) {
        finalAttributes[attr] = Math.max(40, Math.min(99, finalAttributes[attr] + mod));
      }
    }

    // Create the player document
    const playerRef = await addDoc(collection(this.firestore, 'players'), {
      ...this.playerForm,
      userId: user.uid,
      teamId: 'none',
      status: 'active',
      createdDate: new Date()
    });

    // Create attributes document
    await setDoc(doc(this.firestore, `players/${playerRef.id}/meta/attributes`), finalAttributes);

    // Add creation to player history
    await addDoc(collection(this.firestore, `players/${playerRef.id}/history`), {
      action: 'created',
      teamId: 'none',
      timestamp: new Date(),
      details: 'Player entered the league'
    });

    this.hasActivePlayer = true;
    this.hasRetiredPlayer = false;
    this.showCreateForm = false;
    this.router.navigate(['/player']);
  }

  createNewPlayer() {
    // Reset form and show creation form
    this.playerForm = {
      firstName: '',
      lastName: '',
      gamertag: '',
      position: '',
      archetype: '',
      jerseyNumber: 0,
      handedness: '',
      height: 72,
      weight: 180,
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
    this.filteredArchetypes = [];
    this.hasActivePlayer = false;
    this.hasRetiredPlayer = false;
    this.showCreateForm = true;
  }
}