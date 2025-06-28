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
    if (!user) {
      this.loading = false;
      return;
    }

    await this.checkPlayerStatus(user.uid);
    this.loading = false;
  }

  async checkPlayerStatus(userId: string) {
    try {
      // Reset all states first
      this.hasActivePlayer = false;
      this.hasRetiredPlayer = false;
      this.hasPendingPlayer = false;
      this.showCreateForm = false;

      // Check for players in the main players collection
      const playerQuery = query(
        collection(this.firestore, 'players'),
        where('userId', '==', userId)
      );
      const playerSnapshot = await getDocs(playerQuery);
      
      if (!playerSnapshot.empty) {
        const playerData = playerSnapshot.docs[0].data();
        console.log('Found player with status:', playerData['status']); // Debug log
        
        if (playerData['status'] === 'retired') {
          this.hasRetiredPlayer = true;
          this.retiredPlayerName = `${playerData['firstName']} ${playerData['lastName']}`;
          return;
        } else if (playerData['status'] === 'active') {
          this.hasActivePlayer = true;
          return;
        }
      }

      // If no active/retired player found, check for pending requests
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
        return;
      }

      // No player found at all - show create form
      this.showCreateForm = true;
    } catch (error) {
      console.error('Error checking player status:', error);
      // On error, default to showing create form
      this.showCreateForm = true;
    }
  }

  // Add a method to refresh player status (can be called from outside)
  async refreshPlayerStatus() {
    const user = this.auth.currentUser;
    if (!user) return;

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