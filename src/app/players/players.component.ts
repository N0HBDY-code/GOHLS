import { Component, inject, OnInit, OnDestroy } from '@angular/core';
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
export class PlayersComponent implements OnInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);

  hasActivePlayer = false;
  hasRetiredPlayer = false;
  hasPendingPlayer = false;
  loading = true;
  retiredPlayerName = '';
  pendingPlayerName = '';
  showCreateForm = false;

  filteredArchetypes: string[] = [];

  // Event listener for player retirement
  private retirementListener?: () => void;

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
    if (!user) {
      this.loading = false;
      return;
    }

    // Set up event listener for player retirement
    this.retirementListener = () => {
      console.log('Player retirement event received, refreshing status...');
      this.refreshPlayerStatus();
    };
    window.addEventListener('playerRetired', this.retirementListener);

    await this.checkPlayerStatus(user.uid);
    this.loading = false;
  }

  ngOnDestroy() {
    // Clean up event listener
    if (this.retirementListener) {
      window.removeEventListener('playerRetired', this.retirementListener);
    }
  }

  async checkPlayerStatus(userId: string) {
    try {
      console.log('Checking player status for user:', userId);
      
      // Reset all states first
      this.resetAllStates();

      // Check for players in the main players collection first
      const playerQuery = query(
        collection(this.firestore, 'players'),
        where('userId', '==', userId)
      );
      const playerSnapshot = await getDocs(playerQuery);
      
      console.log('Found players in main collection:', playerSnapshot.docs.length);
      
      if (!playerSnapshot.empty) {
        const playerData = playerSnapshot.docs[0].data();
        const playerStatus = playerData['status'];
        console.log('Player status:', playerStatus);
        
        if (playerStatus === 'retired') {
          this.hasRetiredPlayer = true;
          this.retiredPlayerName = `${playerData['firstName']} ${playerData['lastName']}`;
          console.log('Player is retired:', this.retiredPlayerName);
          return;
        } else if (playerStatus === 'active') {
          this.hasActivePlayer = true;
          console.log('Player is active');
          return;
        }
      }

      // If no active/retired player found, check for pending requests
      console.log('No active/retired player found, checking pending...');
      const pendingQuery = query(
        collection(this.firestore, 'pendingPlayers'),
        where('userId', '==', userId),
        where('status', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      
      console.log('Found pending players:', pendingSnapshot.docs.length);
      
      if (!pendingSnapshot.empty) {
        const pendingData = pendingSnapshot.docs[0].data();
        this.hasPendingPlayer = true;
        this.pendingPlayerName = `${pendingData['firstName']} ${pendingData['lastName']}`;
        console.log('Player is pending:', this.pendingPlayerName);
        return;
      }

      // No player found at all - show create form
      console.log('No player found, showing create form');
      this.showCreateForm = true;
    } catch (error) {
      console.error('Error checking player status:', error);
      // On error, default to showing create form
      this.showCreateForm = true;
    }
  }

  private resetAllStates() {
    this.hasActivePlayer = false;
    this.hasRetiredPlayer = false;
    this.hasPendingPlayer = false;
    this.showCreateForm = false;
    this.retiredPlayerName = '';
    this.pendingPlayerName = '';
  }

  // Add a method to refresh player status (can be called from outside)
  async refreshPlayerStatus() {
    const user = this.auth.currentUser;
    if (!user) return;

    console.log('Manually refreshing player status...');
    this.loading = true;
    await this.checkPlayerStatus(user.uid);
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

    try {
      // Create a pending player request instead of a full player
      await addDoc(collection(this.firestore, 'pendingPlayers'), {
        ...this.playerForm,
        userId: user.uid,
        status: 'pending',
        submittedDate: new Date(),
        userEmail: user.email,
        userDisplayName: user.displayName
      });

      // Update component state immediately to show pending player
      this.resetAllStates();
      this.hasPendingPlayer = true;
      this.pendingPlayerName = `${this.playerForm.firstName} ${this.playerForm.lastName}`;

      alert('Your player has been submitted for approval! You can now view your pending player below.');
    } catch (error) {
      console.error('Error submitting player:', error);
      alert('Failed to submit player. Please try again.');
    }
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
    this.resetAllStates();
    this.showCreateForm = true;
  }
}