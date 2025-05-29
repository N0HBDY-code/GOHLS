import { Component } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { trigger, transition, style, animate } from '@angular/animations';

interface Team {
  id?: string;
  city: string;
  mascot: string;
  logoFile: File | null;
  logoUrl?: string;
  conference: string;
  division: string;
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
}

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.css'],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)', opacity: 0 }),
        animate('300ms ease-in', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ transform: 'translateY(-100%)', opacity: 0 }))
      ])
    ])
  ]
})
export class TeamsComponent {
  city = '';
  mascot = '';
  logoFile: File | null = null;
  selectedConference = '';
  selectedDivision = '';
  teams: Team[] = [];
  canManageTeams = false;
  primaryColor = '#000000';
  secondaryColor = '#FFFFFF';
  tertiaryColor = '#808080';
  showAddTeamForm = false;

  showEditTeamModal = false;
  editTeamData?: Team;

  conferences = [
    {
      name: 'Mr. Hockey Conference',
      divisions: ['Europe Division', 'Great Lakes Division', 'Atlantic Division']
    },
    {
      name: 'The Rocket Conference',
      divisions: ['Northwest Division', 'Pacific Division', 'South Division']
    }
  ];

  constructor(
    private firestore: Firestore, 
    private router: Router,
    private authService: AuthService
  ) {
    this.loadTeams();
    this.authService.effectiveRoles.subscribe(roles => {
      this.canManageTeams = roles.some(role => 
        ['developer', 'commissioner'].includes(role)
      );
    });
  }

  async loadTeams() {
    const teamsRef = collection(this.firestore, 'teams');
    const snapshot = await getDocs(teamsRef);
    this.teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
  }

  onFileSelected(event: any) {
    this.logoFile = event.target.files[0] || null;
  }

  onEditLogoSelected(event: any) {
    if (this.editTeamData) {
      this.editTeamData.logoFile = event.target.files[0] || null;
    }
  }

  async addTeam() {
    if (!this.canManageTeams) return;

    if (!this.city || !this.mascot || !this.logoFile || !this.selectedConference || !this.selectedDivision) {
      alert('All fields are required.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const newTeam: Team = {
        city: this.city,
        mascot: this.mascot,
        logoFile: this.logoFile,
        logoUrl: reader.result as string,
        conference: this.selectedConference,
        division: this.selectedDivision,
        primaryColor: this.primaryColor,
        secondaryColor: this.secondaryColor,
        tertiaryColor: this.tertiaryColor
      };

      await addDoc(collection(this.firestore, 'teams'), {
        city: newTeam.city,
        mascot: newTeam.mascot,
        logoUrl: newTeam.logoUrl,
        conference: newTeam.conference,
        division: newTeam.division,
        name: `${newTeam.city} ${newTeam.mascot}`,
        primaryColor: newTeam.primaryColor,
        secondaryColor: newTeam.secondaryColor,
        tertiaryColor: newTeam.tertiaryColor
      });

      this.city = '';
      this.mascot = '';
      this.logoFile = null;
      this.selectedConference = '';
      this.selectedDivision = '';
      this.primaryColor = '#000000';
      this.secondaryColor = '#FFFFFF';
      this.tertiaryColor = '#808080';
      this.showAddTeamForm = false;
      await this.loadTeams();
    };

    reader.readAsDataURL(this.logoFile);
  }

  async deleteTeam(id: string) {
    if (!this.canManageTeams) return;
    await deleteDoc(doc(this.firestore, `teams/${id}`));
    await this.loadTeams();
  }

  viewTeam(teamId: string) {
    this.router.navigate(['/teams', teamId]);
  }

  getTeamsByDivision(conference: string, division: string): Team[] {
    return this.teams.filter(t => t.conference === conference && t.division === division);
  }

  openEditTeamModal(team: Team) {
    if (!this.canManageTeams) return;
    this.editTeamData = { 
      ...team, 
      logoFile: null,
      primaryColor: team.primaryColor || '#000000',
      secondaryColor: team.secondaryColor || '#FFFFFF',
      tertiaryColor: team.tertiaryColor || '#808080'
    };
    this.showEditTeamModal = true;
  }

  async saveTeamChanges() {
    if (!this.canManageTeams || !this.editTeamData?.id) return;

    const updates: any = {
      city: this.editTeamData.city,
      mascot: this.editTeamData.mascot,
      conference: this.editTeamData.conference,
      division: this.editTeamData.division,
      name: `${this.editTeamData.city} ${this.editTeamData.mascot}`,
      primaryColor: this.editTeamData.primaryColor,
      secondaryColor: this.editTeamData.secondaryColor,
      tertiaryColor: this.editTeamData.tertiaryColor
    };

    if (this.editTeamData.logoFile) {
      const reader = new FileReader();
      reader.onload = async () => {
        updates.logoUrl = reader.result as string;
        await updateDoc(doc(this.firestore, `teams/${this.editTeamData!.id}`), updates);
        this.showEditTeamModal = false;
        this.editTeamData = undefined;
        await this.loadTeams();
      };
      reader.readAsDataURL(this.editTeamData.logoFile);
    } else {
      await updateDoc(doc(this.firestore, `teams/${this.editTeamData.id}`), updates);
      this.showEditTeamModal = false;
      this.editTeamData = undefined;
      await this.loadTeams();
    }
  }

  getDivisionsForConference(confName: string): string[] {
    const conf = this.conferences.find(c => c.name === confName);
    return conf?.divisions ?? [];
  }
}