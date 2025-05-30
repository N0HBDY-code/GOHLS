import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RosterComponent } from '../roster/roster.component';
import { Firestore, doc, getDoc, collection, getDocs, query, where } from '@angular/fire/firestore';
import { AuthService } from '../auth.service';
import { ContractService } from '../services/contract.service';
import { TradeService, TradeOffer } from '../services/trade.service';
import { FreeAgencyService } from '../services/free-agency.service';

interface Player {
  id?: string;
  firstName: string;
  lastName: string;
  position: string;
  number: number;
  selected?: boolean;
  teamId: string;
  overall?: number;
  salary?: number;
  contractYears?: number;
  capHit?: number;
  signingBonus?: number;
  performanceBonus?: number;
}

interface Team {
  id: string;
  name: string;
  city: string;
  mascot: string;
}

@Component({
  selector: 'app-team-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RosterComponent],
  templateUrl: './team-detail.component.html',
  styleUrls: ['./team-detail.component.css']
})
export class TeamDetailComponent implements OnInit {
  teamId: string;
  teamName: string = '';
  teamLogo: string = '';
  canManageTeam = false;
  showManageModal = false;
  currentTab: 'trades' | 'contracts' | 'freeagents' = 'trades';
  isLoading = false;

  // Trade-related properties
  selectedTradePartner: string = '';
  availableTradePartners: Team[] = [];
  yourPlayers: Player[] = [];
  partnerPlayers: Player[] = [];
  incomingTradeOffers: TradeOffer[] = [];
  loadingTrades = false;
  playerCache: Map<string, string> = new Map();

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private authService: AuthService,
    private contractService: ContractService,
    private tradeService: TradeService,
    private freeAgencyService: FreeAgencyService
  ) {
    this.teamId = this.route.snapshot.paramMap.get('id')!;
  }

  async ngOnInit() {
    this.isLoading = true;
    try {
      // Check if user can manage team
      this.authService.effectiveRoles.subscribe(roles => {
        this.canManageTeam = roles.some(role => 
          ['developer', 'commissioner', 'gm'].includes(role)
        );
      });

      if (this.teamId) {
        const teamRef = doc(this.firestore, `teams/${this.teamId}`);
        const teamSnap = await getDoc(teamRef);
        if (teamSnap.exists()) {
          const data = teamSnap.data();
          this.teamName = `${data['city']} ${data['mascot']}`;
          this.teamLogo = data['logoUrl'] || '';
        }

        await this.loadTradePartners();
        await this.loadIncomingTradeOffers();
      }
    } finally {
      this.isLoading = false;
    }
  }

  async loadTradePartners() {
    const teamsRef = collection(this.firestore, 'teams');
    const snapshot = await getDocs(teamsRef);
    this.availableTradePartners = snapshot.docs
      .map(doc => ({
        id: doc.id,
        name: `${doc.data()['city']} ${doc.data()['mascot']}`,
        city: doc.data()['city'],
        mascot: doc.data()['mascot']
      }))
      .filter(team => team.id !== this.teamId);
  }

  async loadIncomingTradeOffers() {
    this.loadingTrades = true;
    try {
      const offers = await this.tradeService.getTradeOffersForTeam(this.teamId);
      this.incomingTradeOffers = offers.filter(offer => offer.status === 'pending');

      // Pre-load player names for trade offers
      const playerIds = new Set([
        ...this.incomingTradeOffers.flatMap(o => o.playersOffered),
        ...this.incomingTradeOffers.flatMap(o => o.playersRequested)
      ]);

      const playersRef = collection(this.firestore, 'players');
      const q = query(playersRef, where('__name__', 'in', Array.from(playerIds)));
      const playersSnap = await getDocs(q);
      
      playersSnap.docs.forEach(doc => {
        const data = doc.data();
        this.playerCache.set(doc.id, `${data['firstName']} ${data['lastName']}`);
      });
    } finally {
      this.loadingTrades = false;
    }
  }

  async onTradePartnerSelect() {
    if (!this.selectedTradePartner) return;

    this.isLoading = true;
    try {
      // Load rosters in parallel
      const [yourRosterSnap, partnerRosterSnap] = await Promise.all([
        getDocs(collection(this.firestore, `teams/${this.teamId}/roster`)),
        getDocs(collection(this.firestore, `teams/${this.selectedTradePartner}/roster`))
      ]);

      this.yourPlayers = yourRosterSnap.docs.map(doc => ({
        ...doc.data() as Player,
        id: doc.id,
        selected: false
      }));

      this.partnerPlayers = partnerRosterSnap.docs.map(doc => ({
        ...doc.data() as Player,
        id: doc.id,
        selected: false
      }));
    } finally {
      this.isLoading = false;
    }
  }

  getTeamName(teamId: string): string {
    if (teamId === this.teamId) return this.teamName;
    const team = this.availableTradePartners.find(t => t.id === teamId);
    return team ? `${team.city} ${team.mascot}` : 'Unknown Team';
  }

  getPlayerName(playerId: string): string {
    return this.playerCache.get(playerId) || 'Loading...';
  }

  getSelectedYourPlayers(): Player[] {
    return this.yourPlayers.filter(p => p.selected);
  }

  getSelectedPartnerPlayers(): Player[] {
    return this.partnerPlayers.filter(p => p.selected);
  }

  updateTradeSummary() {
    // This method is called when checkboxes are changed
    // The template will automatically update based on the selected players
  }

  canProposeTrade(): boolean {
    return this.getSelectedYourPlayers().length > 0 || 
           this.getSelectedPartnerPlayers().length > 0;
  }

  async proposeTrade() {
    if (!this.selectedTradePartner) return;

    this.isLoading = true;
    try {
      const tradeOffer = {
        fromTeamId: this.teamId,
        toTeamId: this.selectedTradePartner,
        playersOffered: this.getSelectedYourPlayers().map(p => p.id!),
        playersRequested: this.getSelectedPartnerPlayers().map(p => p.id!)
      };

      await this.tradeService.proposeTrade(tradeOffer);
      
      // Reset selections
      this.yourPlayers.forEach(p => p.selected = false);
      this.partnerPlayers.forEach(p => p.selected = false);
      
      alert('Trade proposal sent successfully!');
    } catch (error) {
      console.error('Error proposing trade:', error);
      alert('Failed to propose trade. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  async acceptTrade(offer: TradeOffer) {
    this.isLoading = true;
    try {
      await this.tradeService.acceptTrade(offer);
      await this.loadIncomingTradeOffers();
      alert('Trade accepted successfully!');
    } catch (error) {
      console.error('Error accepting trade:', error);
      alert('Failed to accept trade. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  async rejectTrade(offer: TradeOffer) {
    this.isLoading = true;
    try {
      await this.tradeService.rejectTrade(offer);
      await this.loadIncomingTradeOffers();
      alert('Trade rejected successfully!');
    } catch (error) {
      console.error('Error rejecting trade:', error);
      alert('Failed to reject trade. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }
}