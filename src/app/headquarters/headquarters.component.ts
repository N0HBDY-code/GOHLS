import { Component, inject, OnInit } from '@angular/core';
import { Firestore, collection, getDocs, updateDoc, doc, arrayUnion, arrayRemove, query, where, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradeService, TradeOffer } from '../services/trade.service';

@Component({
  selector: 'app-headquarters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './headquarters.component.html',
  styleUrls: ['./headquarters.component.css']
})
export class HeadquartersComponent implements OnInit {
  private firestore = inject(Firestore);
  private tradeService = inject(TradeService);

  // Role Management
  searchUsername = '';
  selectedUser: any = null;
  selectedRole = '';
  loading = false;
  error = '';
  success = '';

  // Trade Management
  pendingTrades: TradeOffer[] = [];
  loadingTrades = false;
  playerCache: Map<string, string> = new Map();
  teamCache: Map<string, string> = new Map();

  availableRoles = [
    'viewer',
    'developer',
    'commissioner',
    'gm',
    'stats monkey',
    'finance officer',
    'progression tracker'
  ];

  async ngOnInit() {
    await this.loadPendingTrades();
  }

  async loadPendingTrades() {
    this.loadingTrades = true;
    try {
      this.pendingTrades = await this.tradeService.getPendingTradeApprovals();
      
      // Load team and player names
      const teamIds = new Set<string>();
      const playerIds = new Set<string>();

      this.pendingTrades.forEach(trade => {
        teamIds.add(trade.fromTeamId);
        teamIds.add(trade.toTeamId);
        trade.playersOffered.forEach(id => playerIds.add(id));
        trade.playersRequested.forEach(id => playerIds.add(id));
      });

      // Load team names
      for (const teamId of teamIds) {
        const teamSnap = await getDoc(doc(this.firestore, `teams/${teamId}`));
        if (teamSnap.exists()) {
          const data = teamSnap.data();
          this.teamCache.set(teamId, `${data['city']} ${data['mascot']}`);
        }
      }

      // Load player names
      for (const playerId of playerIds) {
        const playerSnap = await getDoc(doc(this.firestore, `players/${playerId}`));
        if (playerSnap.exists()) {
          const data = playerSnap.data();
          this.playerCache.set(playerId, `${data['firstName']} ${data['lastName']}`);
        }
      }
    } finally {
      this.loadingTrades = false;
    }
  }

  getTeamName(teamId: string): string {
    return this.teamCache.get(teamId) || 'Unknown Team';
  }

  getPlayerName(playerId: string): string {
    return this.playerCache.get(playerId) || 'Unknown Player';
  }

  async approveTrade(trade: TradeOffer) {
    this.loading = true;
    try {
      await this.tradeService.approveTrade(trade);
      await this.loadPendingTrades();
      this.success = 'Trade approved successfully';
    } catch (error) {
      console.error('Error approving trade:', error);
      this.error = 'Failed to approve trade';
    } finally {
      this.loading = false;
    }
  }

  async denyTrade(trade: TradeOffer) {
    this.loading = true;
    try {
      await this.tradeService.denyTrade(trade);
      await this.loadPendingTrades();
      this.success = 'Trade denied successfully';
    } catch (error) {
      console.error('Error denying trade:', error);
      this.error = 'Failed to deny trade';
    } finally {
      this.loading = false;
    }
  }

  async searchUser() {
    if (!this.searchUsername.trim()) {
      this.error = 'Please enter a username';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';
    this.selectedUser = null;

    try {
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('displayName', '==', this.searchUsername));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        this.error = 'User not found';
        return;
      }

      const userDoc = snapshot.docs[0];
      this.selectedUser = {
        uid: userDoc.id,
        ...userDoc.data(),
        roles: userDoc.data()['roles'] || []
      };
    } catch (error) {
      console.error('Error searching user:', error);
      this.error = 'Error searching for user';
    } finally {
      this.loading = false;
    }
  }

  async addRole() {
    if (!this.selectedUser || !this.selectedRole) return;

    this.loading = true;
    this.error = '';
    this.success = '';

    try {
      const userRef = doc(this.firestore, 'users', this.selectedUser.uid);
      await updateDoc(userRef, {
        roles: arrayUnion(this.selectedRole)
      });

      this.selectedUser.roles.push(this.selectedRole);
      this.selectedRole = '';
      this.success = 'Role added successfully';
    } catch (error) {
      console.error('Error adding role:', error);
      this.error = 'Failed to add role';
    } finally {
      this.loading = false;
    }
  }

  async removeRole(role: string) {
    if (!this.selectedUser) return;

    this.loading = true;
    this.error = '';
    this.success = '';

    try {
      const userRef = doc(this.firestore, 'users', this.selectedUser.uid);
      await updateDoc(userRef, {
        roles: arrayRemove(role)
      });

      this.selectedUser.roles = this.selectedUser.roles.filter((r: string) => r !== role);
      this.success = 'Role removed successfully';
    } catch (error) {
      console.error('Error removing role:', error);
      this.error = 'Failed to remove role';
    } finally {
      this.loading = false;
    }
  }
}