import { Component } from '@angular/core';
import { Firestore, collection, addDoc, doc, deleteDoc, updateDoc, query, getDocs, orderBy, limit, startAfter, DocumentData, QueryDocumentSnapshot } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { RosterComponent } from '../roster/roster.component';

interface Team {
  id?: string;
  name: string;
  sport: string;
  city: string;
}

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [CommonModule, FormsModule, RosterComponent],
  templateUrl: './teams.component.html',
  styleUrls: ['./teams.component.css']
})
export class TeamsComponent {
  name = '';
  sport = '';
  city = '';
  editModeId: string | null = null;
  selectedTeamId: string | null = null;

  teams: Team[] = [];
  lastTeamDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  pageSize = 5;

  private teamsRef;

  constructor(private firestore: Firestore) {
    this.teamsRef = collection(this.firestore, 'teams');
  }

  async ngOnInit(): Promise<void> {
    await this.loadTeams();
  }

  async loadTeams() {
    const q = query(this.teamsRef, orderBy('name'), limit(this.pageSize));
    const snapshot = await getDocs(q);
    this.teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
    this.lastTeamDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  }

  async loadNextPage() {
    if (!this.lastTeamDoc) return;
    const q = query(this.teamsRef, orderBy('name'), startAfter(this.lastTeamDoc), limit(this.pageSize));
    const snapshot = await getDocs(q);
    const nextTeams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
    this.teams = [...this.teams, ...nextTeams];
    this.lastTeamDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  }

  async addTeam() {
    if (!this.name || !this.sport || !this.city) {
      alert('Please fill in all fields');
      return;
    }

    const newTeam: Team = { name: this.name, sport: this.sport, city: this.city };
    await addDoc(this.teamsRef, newTeam);
    this.clearForm();
    await this.loadTeams(); // refresh
  }

  startEdit(team: Team) {
    this.editModeId = team.id!;
    this.name = team.name;
    this.sport = team.sport;
    this.city = team.city;
  }

  async updateTeam() {
    if (!this.editModeId) return;
    const teamDoc = doc(this.firestore, `teams/${this.editModeId}`);
    await updateDoc(teamDoc, {
      name: this.name,
      sport: this.sport,
      city: this.city
    });
    this.clearForm();
    await this.loadTeams();
  }

  async deleteTeam(id: string) {
    const teamDoc = doc(this.firestore, `teams/${id}`);
    await deleteDoc(teamDoc);
    await this.loadTeams();
  }

  cancelEdit() {
    this.clearForm();
  }

  private clearForm() {
    this.name = '';
    this.sport = '';
    this.city = '';
    this.editModeId = null;
  }

  toggleRoster(teamId: string) {
    this.selectedTeamId = this.selectedTeamId === teamId ? null : teamId;
  }
}