import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RosterComponent } from '../roster/roster.component';
import { Firestore, doc, getDoc, collection, getDocs } from '@angular/fire/firestore';
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

  // Trade-related properties
  selectedTradePartner: string = '';
  availableTradePartners: Team[] = [];
  yourPlayers: Player[] = [];
  partnerPlayers: Player[] = [];
  incomingTradeOffers: TradeOffer[] = [];

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
    this.incomingTradeOffers = await this.tradeService.getTradeOffersForTeam(this.teamId);
  }

  async onTradePartnerSelect() {
    if (!this.selectedTradePartner) return;

    // Load your team's roster
    const yourRosterRef = collection(this.firestore, `teams/${this.teamId}/roster`);
    const yourRosterSnap = await getDocs(yourRosterRef);
    this.yourPlayers = yourRosterSnap.docs.map(doc => ({
      ...doc.data() as Player,
      id: doc.id,
      selected: false
    }));

    // Load partner team's roster
    const partnerRosterRef = collection(this.firestore, `teams/${this.selectedTradePartner}/roster`);
    const partnerRosterSnap = await getDocs(partnerRosterRef);
    this.partnerPlayers = partnerRosterSnap.docs.map(doc => ({
      ...doc.data() as Player,
      id: doc.id,
      selected: false
    }));
  }

  getTeamName(teamId: string): string {
    if (teamId === this.teamId) return this.teamName;
    const team = this.availableTradePartners.find(t => t.id === teamId);
    return team ? `${team.city} ${team.mascot}` : 'Unknown Team';
  }

  async getPlayerName(playerId: string): Promise<string> {
    const playerRef = doc(this.firestore, `players/${playerId}`);
    const playerSnap = await getDoc(playerRef);
    if (playerSnap.exists()) {
      const data = playerSnap.data();
      return `${data['firstName']} ${data['lastName']}`;
    }
    return 'Unknown Player';
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
  }

  async acceptTrade(offer: TradeOffer) {
    await this.tradeService.acceptTrade(offer);
    await this.loadIncomingTradeOffers();
  }

  async rejectTrade(offer: TradeOffer) {
    await this.tradeService.rejectTrade(offer);
    await this.loadIncomingTradeOffers();
  }
}