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

  private getArchetypeBaseAttributes(archetype: string): { [key: string]: number } {
    // Base attributes from the template - these are the starting values before height/weight modifiers
    switch (archetype) {
      case 'Playmaker':
        return {
          'SPEED': 66, 'BODY CHK': 66, 'ENDUR': 66, 'PK CTRL': 66, 'PASSING': 75,
          'SHT/PSS': 66, 'SLAP PWR': 66, 'SLAP ACC': 66, 'WRI PWR': 66, 'WRI ACC': 77,
          'AGILITY': 66, 'STRENGTH': 66, 'ACCEL': 66, 'BALANCE': 66, 'FACEOFF': 75,
          'DRBLTY': 75, 'DEKE': 75, 'AGGRE': 65, 'POISE': 70, 'HND EYE': 75,
          'SHT BLK': 65, 'OFF AWR': 75, 'DEF AWR': 66, 'DISCIP': 66, 'FIGHTING': 65,
          'STK CHK': 65
        };

      case 'Sniper':
        return {
          'SPEED': 66, 'BODY CHK': 66, 'ENDUR': 66, 'PK CTRL': 66, 'PASSING': 66,
          'SHT/PSS': 66, 'SLAP PWR': 66, 'SLAP ACC': 66, 'WRI PWR': 66, 'WRI ACC': 66,
          'AGILITY': 66, 'STRENGTH': 66, 'ACCEL': 66, 'BALANCE': 66, 'FACEOFF': 66,
          'DRBLTY': 66, 'DEKE': 66, 'AGGRE': 66, 'POISE': 66, 'HND EYE': 66,
          'SHT BLK': 66, 'OFF AWR': 66, 'DEF AWR': 66, 'DISCIP': 66, 'FIGHTING': 66,
          'STK CHK': 66
        };

      case '2-Way Forward':
        return {
          'SPEED': 66, 'BODY CHK': 66, 'ENDUR': 66, 'PK CTRL': 66, 'PASSING': 66,
          'SHT/PSS': 66, 'SLAP PWR': 66, 'SLAP ACC': 66, 'WRI PWR': 66, 'WRI ACC': 66,
          'AGILITY': 66, 'STRENGTH': 66, 'ACCEL': 66, 'BALANCE': 66, 'FACEOFF': 66,
          'DRBLTY': 66, 'DEKE': 66, 'AGGRE': 66, 'POISE': 66, 'HND EYE': 66,
          'SHT BLK': 66, 'OFF AWR': 66, 'DEF AWR': 66, 'DISCIP': 66, 'FIGHTING': 66,
          'STK CHK': 66
        };

      case 'Power Forward':
        return {
          'SPEED': 66, 'BODY CHK': 66, 'ENDUR': 66, 'PK CTRL': 66, 'PASSING': 66,
          'SHT/PSS': 66, 'SLAP PWR': 66, 'SLAP ACC': 66, 'WRI PWR': 66, 'WRI ACC': 66,
          'AGILITY': 66, 'STRENGTH': 66, 'ACCEL': 66, 'BALANCE': 66, 'FACEOFF': 66,
          'DRBLTY': 66, 'DEKE': 66, 'AGGRE': 66, 'POISE': 66, 'HND EYE': 66,
          'SHT BLK': 66, 'OFF AWR': 66, 'DEF AWR': 66, 'DISCIP': 66, 'FIGHTING': 66,
          'STK CHK': 66
        };

      case 'Enforcer Forward':
        return {
          'SPEED': 66, 'BODY CHK': 66, 'ENDUR': 66, 'PK CTRL': 66, 'PASSING': 66,
          'SHT/PSS': 66, 'SLAP PWR': 66, 'SLAP ACC': 66, 'WRI PWR': 66, 'WRI ACC': 66,
          'AGILITY': 66, 'STRENGTH': 66, 'ACCEL': 66, 'BALANCE': 66, 'FACEOFF': 66,
          'DRBLTY': 66, 'DEKE': 66, 'AGGRE': 66, 'POISE': 66, 'HND EYE': 66,
          'SHT BLK': 66, 'OFF AWR': 66, 'DEF AWR': 66, 'DISCIP': 66, 'FIGHTING': 66,
          'STK CHK': 66
        };

      case 'Grinder':
        return {
          'SPEED': 66, 'BODY CHK': 66, 'ENDUR': 66, 'PK CTRL': 66, 'PASSING': 66,
          'SHT/PSS': 66, 'SLAP PWR': 66, 'SLAP ACC': 66, 'WRI PWR': 66, 'WRI ACC': 66,
          'AGILITY': 66, 'STRENGTH': 66, 'ACCEL': 66, 'BALANCE': 66, 'FACEOFF': 66,
          'DRBLTY': 66, 'DEKE': 66, 'AGGRE': 66, 'POISE': 66, 'HND EYE': 66,
          'SHT BLK': 66, 'OFF AWR': 66, 'DEF AWR': 66, 'DISCIP': 66, 'FIGHTING': 66,
          'STK CHK': 66
        };

      case 'Defensive Defense':
        return {
          'SPEED': 66, 'BODY CHK': 66, 'ENDUR': 66, 'PK CTRL': 66, 'PASSING': 66,
          'SHT/PSS': 66, 'SLAP PWR': 66, 'SLAP ACC': 66, 'WRI PWR': 66, 'WRI ACC': 66,
          'AGILITY': 66, 'STRENGTH': 66, 'ACCEL': 66, 'BALANCE': 66, 'FACEOFF': 66,
          'DRBLTY': 66, 'DEKE': 66, 'AGGRE': 66, 'POISE': 66, 'HND EYE': 66,
          'SHT BLK': 66, 'OFF AWR': 66, 'DEF AWR': 66, 'DISCIP': 66, 'FIGHTING': 66,
          'STK CHK': 66
        };

      case 'Offensive Defense':
        return {
          'SPEED': 66, 'BODY CHK': 66, 'ENDUR': 66, 'PK CTRL': 66, 'PASSING': 66,
          'SHT/PSS': 66, 'SLAP PWR': 66, 'SLAP ACC': 66, 'WRI PWR': 66, 'WRI ACC': 66,
          'AGILITY': 66, 'STRENGTH': 66, 'ACCEL': 66, 'BALANCE': 66, 'FACEOFF': 66,
          'DRBLTY': 66, 'DEKE': 66, 'AGGRE': 66, 'POISE': 66, 'HND EYE': 66,
          'SHT BLK': 66, 'OFF AWR': 66, 'DEF AWR': 66, 'DISCIP': 66, 'FIGHTING': 66,
          'STK CHK': 66
        };

      case '2-Way Defense':
        return {
          'SPEED': 66, 'BODY CHK': 66, 'ENDUR': 66, 'PK CTRL': 66, 'PASSING': 66,
          'SHT/PSS': 66, 'SLAP PWR': 66, 'SLAP ACC': 66, 'WRI PWR': 66, 'WRI ACC': 66,
          'AGILITY': 66, 'STRENGTH': 66, 'ACCEL': 66, 'BALANCE': 66, 'FACEOFF': 66,
          'DRBLTY': 66, 'DEKE': 66, 'AGGRE': 66, 'POISE': 66, 'HND EYE': 66,
          'SHT BLK': 66, 'OFF AWR': 66, 'DEF AWR': 66, 'DISCIP': 66, 'FIGHTING': 66,
          'STK CHK': 66
        };

      case 'Enforcer Defense':
        return {
          'SPEED': 66, 'BODY CHK': 66, 'ENDUR': 66, 'PK CTRL': 66, 'PASSING': 66,
          'SHT/PSS': 66, 'SLAP PWR': 66, 'SLAP ACC': 66, 'WRI PWR': 66, 'WRI ACC': 66,
          'AGILITY': 66, 'STRENGTH': 66, 'ACCEL': 66, 'BALANCE': 66, 'FACEOFF': 66,
          'DRBLTY': 66, 'DEKE': 66, 'AGGRE': 66, 'POISE': 66, 'HND EYE': 66,
          'SHT BLK': 66, 'OFF AWR': 66, 'DEF AWR': 66, 'DISCIP': 66, 'FIGHTING': 66,
          'STK CHK': 66
        };

      // Goalie archetypes
      case 'Hybrid':
      case 'Butterfly':
      case 'Standup':
        return {
          'GLV LOW': 66, 'GLV HIGH': 66, 'STK LOW': 66, 'STK HIGH': 66,
          '5 HOLE': 66, 'SPEED': 68, 'AGILITY': 66, 'CONSIS': 90,
          'PK CTRL': 66, 'ENDUR': 99, 'BRK AWAY': 66, 'RBD CTRL': 92,
          'RECOV': 66, 'POISE': 92, 'PASSING': 66, 'ANGLES': 92,
          'PK PL FRQ': 66, 'AGGRE': 85, 'DRBLTY': 66, 'VISION': 92
        };

      default:
        // Default base attributes
        return {
          'SPEED': 66, 'BODY CHK': 66, 'ENDUR': 66, 'PK CTRL': 66, 'PASSING': 66,
          'SHT/PSS': 66, 'SLAP PWR': 66, 'SLAP ACC': 66, 'WRI PWR': 66, 'WRI ACC': 66,
          'AGILITY': 66, 'STRENGTH': 66, 'ACCEL': 66, 'BALANCE': 66, 'FACEOFF': 66,
          'DRBLTY': 66, 'DEKE': 66, 'AGGRE': 66, 'POISE': 66, 'HND EYE': 66,
          'SHT BLK': 66, 'OFF AWR': 66, 'DEF AWR': 66, 'DISCIP': 66, 'FIGHTING': 66,
          'STK CHK': 66
        };
    }
  }

  private calculateHeightWeightModifiers(): { [key: string]: number } {
    const modifiers: { [key: string]: number } = {};
    
    // Height modifiers (per inch from 6'0" = 72 inches)
    const heightDiff = this.playerForm.height - 72;
    
    // Weight modifiers (per 8 lbs from base weight)
    // Base weights: Forwards/Defense = 180 lbs, Goalies = 180 lbs
    const baseWeight = 180;
    const weightDiff = Math.floor((this.playerForm.weight - baseWeight) / 8);

    if (this.playerForm.position === 'G') {
      // Goalie height modifiers (per inch)
      if (heightDiff !== 0) {
        modifiers['SPEED'] = -2 * heightDiff;
        modifiers['AGILITY'] = -2 * heightDiff;
        modifiers['PK CTRL'] = -2 * heightDiff;
        modifiers['RECOV'] = heightDiff;
        modifiers['ANGLES'] = 2 * heightDiff;
        modifiers['AGGRE'] = heightDiff;
        modifiers['VISION'] = 2 * heightDiff;
      }

      // Goalie weight modifiers (per 8 lbs)
      if (weightDiff !== 0) {
        modifiers['GLV HIGH'] = -weightDiff;
        modifiers['STK HIGH'] = -weightDiff;
        modifiers['SPEED'] = (modifiers['SPEED'] || 0) + (-2 * weightDiff);
        modifiers['AGILITY'] = (modifiers['AGILITY'] || 0) + (-weightDiff);
        modifiers['ENDUR'] = -2 * weightDiff;
        modifiers['RECOV'] = (modifiers['RECOV'] || 0) + (-2 * weightDiff);
        modifiers['AGGRE'] = (modifiers['AGGRE'] || 0) + weightDiff;
        modifiers['DRBLTY'] = 2 * weightDiff;
      }
    } else {
      // Skater height modifiers (per inch)
      if (heightDiff !== 0) {
        modifiers['BALANCE'] = -heightDiff;
        modifiers['AGILITY'] = -heightDiff;
        modifiers['STRENGTH'] = heightDiff;
        modifiers['ACCEL'] = -heightDiff;
      }

      // Skater weight modifiers (per 8 lbs)
      if (weightDiff !== 0) {
        modifiers['SPEED'] = -weightDiff;
        modifiers['BODY CHK'] = 2 * weightDiff;
        modifiers['STRENGTH'] = (modifiers['STRENGTH'] || 0) + (2 * weightDiff);
        modifiers['BALANCE'] = (modifiers['BALANCE'] || 0) + weightDiff;
        modifiers['AGILITY'] = (modifiers['AGILITY'] || 0) + (-weightDiff);
        modifiers['ACCEL'] = (modifiers['ACCEL'] || 0) + (-weightDiff);
      }
    }

    return modifiers;
  }

  async createPlayer() {
    const user = this.auth.currentUser;
    if (!user) return;

    // Get base attributes for the archetype
    const baseAttributes = this.getArchetypeBaseAttributes(this.playerForm.archetype);
    
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