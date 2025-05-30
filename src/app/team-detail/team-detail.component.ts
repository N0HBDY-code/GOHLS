import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RosterComponent } from '../roster/roster.component';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { AuthService } from '../auth.service';
import { ContractService } from '../services/contract.service';
import { TradeService } from '../services/trade.service';
import { FreeAgencyService } from '../services/free-agency.service';

@Component({
  selector: 'app-team-detail',
  standalone: true,
  imports: [CommonModule, RosterComponent],
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
    }
  }
}