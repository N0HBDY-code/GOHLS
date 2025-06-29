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

  // Event listener for player retirement and approval
  private retirementListener?: () => void;
  private approvalListener?: () => void;

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

    // Set up event listeners
    this.retirementListener = () => {
      console.log('🏆 Player retirement event received, refreshing status...');
      this.refreshPlayerStatus();
    };
    
    this.approvalListener = () => {
      console.log('✅ Player approval event received, refreshing status...');
      this.refreshPlayerStatus();
    };

    window.addEventListener('playerRetired', this.retirementListener);
    window.addEventListener('playerApproved', this.approvalListener);

    await this.checkPlayerStatus(user.uid);
    this.loading = false;
  }

  ngOnDestroy() {
    // Clean up event listeners
    if (this.retirementListener) {
      window.removeEventListener('playerRetired', this.retirementListener);
    }
    if (this.approvalListener) {
      window.removeEventListener('playerApproved', this.approvalListener);
    }
  }

  async checkPlayerStatus(userId: string) {
    try {
      console.log('🔍 Checking player status for user:', userId);
      
      // Reset all states first
      this.resetAllStates();

      // FIRST: Check for active players (highest priority after approval)
      console.log('👤 Checking for active players first...');
      const activeQuery = query(
        collection(this.firestore, 'players'),
        where('userId', '==', userId),
        where('status', '==', 'active')
      );
      const activeSnapshot = await getDocs(activeQuery);
      
      console.log('👤 Found active players:', activeSnapshot.docs.length);
      
      if (!activeSnapshot.empty) {
        this.hasActivePlayer = true;
        console.log('⚡ Player is active - showing player manager');
        return; // Exit early - active player found
      }

      // SECOND: Check for retired players
      console.log('🏆 No active player found, checking for retired players...');
      const retiredQuery = query(
        collection(this.firestore, 'players'),
        where('userId', '==', userId),
        where('status', '==', 'retired')
      );
      const retiredSnapshot = await getDocs(retiredQuery);
      
      console.log('🏆 Found retired players:', retiredSnapshot.docs.length);
      
      if (!retiredSnapshot.empty) {
        const retiredData = retiredSnapshot.docs[0].data();
        this.hasRetiredPlayer = true;
        this.retiredPlayerName = `${retiredData['firstName']} ${retiredData['lastName']}`;
        console.log('🏆 Player is retired:', this.retiredPlayerName);
        return;
      }

      // THIRD: Check for pending players (lowest priority)
      console.log('📋 No active/retired player found, checking for pending players...');
      const pendingQuery = query(
        collection(this.firestore, 'pendingPlayers'),
        where('userId', '==', userId),
        where('status', '==', 'pending')
      );
      const pendingSnapshot = await getDocs(pendingQuery);
      
      console.log('📋 Found pending players:', pendingSnapshot.docs.length);
      
      if (!pendingSnapshot.empty) {
        const pendingData = pendingSnapshot.docs[0].data();
        this.hasPendingPlayer = true;
        this.pendingPlayerName = `${pendingData['firstName']} ${pendingData['lastName']}`;
        console.log('⏳ Player is pending:', this.pendingPlayerName);
        return;
      }

      // FOURTH: No player found at all - show create form
      console.log('➕ No player found, showing create form');
      this.showCreateForm = true;
    } catch (error) {
      console.error('❌ Error checking player status:', error);
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

    console.log('🔄 Manually refreshing player status...');
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
      console.log('📝 Creating pending player request...');
      
      // Create a pending player request instead of a full player
      await addDoc(collection(this.firestore, 'pendingPlayers'), {
        ...this.playerForm,
        userId: user.uid,
        status: 'pending',
        submittedDate: new Date(),
        userEmail: user.email,
        userDisplayName: user.displayName
      });

      console.log('✅ Pending player created successfully');

      // Update component state immediately to show pending player
      this.resetAllStates();
      this.hasPendingPlayer = true;
      this.pendingPlayerName = `${this.playerForm.firstName} ${this.playerForm.lastName}`;

      console.log('🎯 Component state updated to show pending player:', this.pendingPlayerName);

      alert('Your player has been submitted for approval! You can now view your pending player below.');
    } catch (error) {
      console.error('❌ Error submitting player:', error);
      alert('Failed to submit player. Please try again.');
    }
  }

  createNewPlayer() {
    console.log('➕ Creating new player - resetting form...');
    
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