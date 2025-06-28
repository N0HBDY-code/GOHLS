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
  hasPendingPlayer = false;
  loading = true;
  retiredPlayerName = '';
  pendingPlayerName = '';
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

    await this.checkPlayerStatus(user.uid);
    this.loading = false;
  }

  async checkPlayerStatus(userId: string) {
    // First check for active players
    const playerQuery = query(
      collection(this.firestore, 'players'),
      where('userId', '==', userId)
    );
    const playerSnapshot = await getDocs(playerQuery);
    
    if (!playerSnapshot.empty) {
      const playerData = playerSnapshot.docs[0].data();
      if (playerData['status'] === 'retired') {
        this.hasRetiredPlayer = true;
        this.retiredPlayerName = `${playerData['firstName']} ${playerData['lastName']}`;
        this.hasActivePlayer = false;
        this.hasPendingPlayer = false;
        this.showCreateForm = false;
        return;
      } else if (playerData['status'] === 'active') {
        this.hasActivePlayer = true;
        this.hasRetiredPlayer = false;
        this.hasPendingPlayer = false;
        this.showCreateForm = false;
        return;
      }
    }

    // If no active player found, check for pending requests
    const pendingQuery = query(
      collection(this.firestore, 'pendingPlayers'),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );
    const pendingSnapshot = await getDocs(pendingQuery);
    
    if (!pendingSnapshot.empty) {
      const pendingData = pendingSnapshot.docs[0].data();
      this.hasPendingPlayer = true;
      this.pendingPlayerName = `${pendingData['firstName']} ${pendingData['lastName']}`;
      this.hasActivePlayer = false;
      this.hasRetiredPlayer = false;
      this.showCreateForm = false;
      return;
    }

    // No player found at all - show create form
    this.hasActivePlayer = false;
    this.hasRetiredPlayer = false;
    this.hasPendingPlayer = false;
    this.showCreateForm = true;
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

      // Update component state
      this.hasPendingPlayer = true;
      this.pendingPlayerName = `${this.playerForm.firstName} ${this.playerForm.lastName}`;
      this.hasActivePlayer = false;
      this.hasRetiredPlayer = false;
      this.showCreateForm = false;

      alert('Your player has been submitted for approval! You will be notified once it has been reviewed by league management.');
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
    this.hasActivePlayer = false;
    this.hasRetiredPlayer = false;
    this.hasPendingPlayer = false;
    this.showCreateForm = true;
  }
}