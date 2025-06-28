import { Component } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, doc, deleteDoc, updateDoc } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';

interface Team {
  id?: string;
  city: string;
  mascot: string;
  logoFile: File | null;
  logoUrl?: string;
  conference: string;
  division: string;
  league: string;
  primaryColor?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
}

interface Conference {
  name: string;
  divisions: string[];
}

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.css']
})
export class TeamsComponent {
  city = '';
  mascot = '';
  logoFile: File | null = null;
  selectedConference = '';
  selectedDivision = '';
  selectedLeague = '';
  teams: Team[] = [];
  canManageTeams = false;
  primaryColor = '#000000';
  secondaryColor = '#FFFFFF';
  tertiaryColor = '#808080';
  showAddTeamForm = false;
  currentLeagueView: 'major' | 'minor' = 'major';

  showEditTeamModal = false;
  editTeamData?: Team;

  // Conference Management
  showAddConferenceForm = false;
  newConferenceName = '';
  
  // Division Management
  showAddDivisionForm = false;
  selectedConferenceForDivision = '';
  newDivisionName = '';

  // Separate conference structures for each league
  majorLeagueConferences: Conference[] = [
    {
      name: 'Mr. Hockey Conference',
      divisions: ['Europe Division', 'Great Lakes Division', 'Atlantic Division']
    },
    {
      name: 'The Rocket Conference',
      divisions: ['Northwest Division', 'Pacific Division', 'South Division']
    }
  ];

  minorLeagueConferences: Conference[] = [
    {
      name: 'Development Conference',
      divisions: ['Eastern Development', 'Western Development', 'Central Development']
    },
    {
      name: 'Prospect Conference',
      divisions: ['Northern Prospects', 'Southern Prospects', 'Coastal Prospects']
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

  get conferences(): Conference[] {
    return this.currentLeagueView === 'major' ? this.majorLeagueConferences : this.minorLeagueConferences;
  }

  get availableConferences(): Conference[] {
    return this.selectedLeague === 'major' ? this.majorLeagueConferences : this.minorLeagueConferences;
  }

  async loadTeams() {
    const teamsRef = collection(this.firestore, 'teams');
    const snapshot = await getDocs(teamsRef);
    this.teams = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      league: doc.data()['league'] || 'major' // Default to major league for existing teams
    } as Team));
  }

  onFileSelected(event: any) {
    this.logoFile = event.target.files[0] || null;
  }

  onEditLogoSelected(event: any) {
    if (this.editTeamData) {
      this.editTeamData.logoFile = event.target.files[0] || null;
    }
  }

  onLeagueChange() {
    // Reset conference and division when league changes
    this.selectedConference = '';
    this.selectedDivision = '';
  }

  async addTeam() {
    if (!this.canManageTeams) return;

    // Check required fields (logo is now optional)
    if (!this.city || !this.mascot || !this.selectedConference || !this.selectedDivision || !this.selectedLeague) {
      alert('City, Mascot, League, Conference, and Division are required.');
      return;
    }

    // Function to create and save team
    const createTeam = async (logoUrl?: string) => {
      const newTeam: Team = {
        city: this.city,
        mascot: this.mascot,
        logoFile: this.logoFile,
        logoUrl: logoUrl || '', // Empty string if no logo
        conference: this.selectedConference,
        division: this.selectedDivision,
        league: this.selectedLeague,
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
        league: newTeam.league,
        name: `${newTeam.city} ${newTeam.mascot}`,
        primaryColor: newTeam.primaryColor,
        secondaryColor: newTeam.secondaryColor,
        tertiaryColor: newTeam.tertiaryColor
      });

      // Reset form
      this.resetForm();
      await this.loadTeams();
    };

    // If logo file is provided, read it and create team with logo
    if (this.logoFile) {
      const reader = new FileReader();
      reader.onload = async () => {
        await createTeam(reader.result as string);
      };
      reader.readAsDataURL(this.logoFile);
    } else {
      // Create team without logo
      await createTeam();
    }
  }

  private resetForm() {
    this.city = '';
    this.mascot = '';
    this.logoFile = null;
    this.selectedConference = '';
    this.selectedDivision = '';
    this.selectedLeague = '';
    this.primaryColor = '#000000';
    this.secondaryColor = '#FFFFFF';
    this.tertiaryColor = '#808080';
    this.showAddTeamForm = false;
  }

  async deleteTeam(id: string) {
    if (!this.canManageTeams) return;

    const team = this.teams.find(t => t.id === id);
    if (!team) return;

    const confirmMessage = `Are you sure you want to delete ${team.city} ${team.mascot}? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;

    await deleteDoc(doc(this.firestore, `teams/${id}`));
    await this.loadTeams();
  }

  viewTeam(teamId: string) {
    this.router.navigate(['/teams', teamId]);
  }

  getTeamsByDivisionAndLeague(conference: string, division: string, league: string): Team[] {
    return this.teams.filter(t => 
      t.conference === conference && 
      t.division === division && 
      (t.league || 'major') === league
    );
  }

  openEditTeamModal(team: Team) {
    if (!this.canManageTeams) return;
    this.editTeamData = { 
      ...team, 
      logoFile: null,
      league: team.league || 'major',
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
      league: this.editTeamData.league,
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
    const currentConferences = this.editTeamData?.league === 'minor' ? this.minorLeagueConferences : this.majorLeagueConferences;
    const conf = currentConferences.find(c => c.name === confName);
    return conf?.divisions ?? [];
  }

  addConference() {
    if (!this.canManageTeams || !this.newConferenceName.trim()) return;
    
    const targetConferences = this.currentLeagueView === 'major' ? this.majorLeagueConferences : this.minorLeagueConferences;
    
    targetConferences.push({
      name: this.newConferenceName,
      divisions: []
    });
    
    this.newConferenceName = '';
    this.showAddConferenceForm = false;
  }

  addDivision() {
    if (!this.canManageTeams || !this.newDivisionName.trim() || !this.selectedConferenceForDivision) return;
    
    const targetConferences = this.currentLeagueView === 'major' ? this.majorLeagueConferences : this.minorLeagueConferences;
    const conference = targetConferences.find(c => c.name === this.selectedConferenceForDivision);
    
    if (conference) {
      conference.divisions.push(this.newDivisionName);
    }
    
    this.newDivisionName = '';
    this.selectedConferenceForDivision = '';
    this.showAddDivisionForm = false;
  }

  deleteConference(conferenceName: string) {
    if (!this.canManageTeams) return;
    
    const currentLeague = this.currentLeagueView;
    if (this.teams.some(t => t.conference === conferenceName && (t.league || 'major') === currentLeague)) {
      alert('Cannot delete conference with existing teams');
      return;
    }

    const confirmMessage = `Are you sure you want to delete the ${conferenceName} from ${currentLeague} league? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;
    
    if (currentLeague === 'major') {
      this.majorLeagueConferences = this.majorLeagueConferences.filter(c => c.name !== conferenceName);
    } else {
      this.minorLeagueConferences = this.minorLeagueConferences.filter(c => c.name !== conferenceName);
    }
  }

  deleteDivision(conferenceName: string, divisionName: string) {
    if (!this.canManageTeams) return;
    
    const currentLeague = this.currentLeagueView;
    if (this.teams.some(t => t.conference === conferenceName && t.division === divisionName && (t.league || 'major') === currentLeague)) {
      alert('Cannot delete division with existing teams');
      return;
    }

    const confirmMessage = `Are you sure you want to delete the ${divisionName} from ${conferenceName} in ${currentLeague} league? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;
    
    const targetConferences = currentLeague === 'major' ? this.majorLeagueConferences : this.minorLeagueConferences;
    const conference = targetConferences.find(c => c.name === conferenceName);
    
    if (conference) {
      conference.divisions = conference.divisions.filter(d => d !== divisionName);
    }
  }
}