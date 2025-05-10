import { Component } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, doc, deleteDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface Team {
  id?: string;
  city: string;
  mascot: string;
  logoFile: File | null;
  logoUrl?: string;
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
  teams: Team[] = [];

  constructor(private firestore: Firestore, private router: Router) {
    this.loadTeams();
  }

  async loadTeams() {
    const teamsRef = collection(this.firestore, 'teams');
    const snapshot = await getDocs(teamsRef);
    this.teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
  }

  onFileSelected(event: any) {
    this.logoFile = event.target.files[0] || null;
  }

  async addTeam() {
    if (!this.city || !this.mascot || !this.logoFile) {
      alert('All fields are required.');
      return;
    }

    // For simplicity, store as base64; for production, use Firebase Storage
    const reader = new FileReader();
    reader.onload = async () => {
      const newTeam: Team = {
        city: this.city,
        mascot: this.mascot,
        logoFile: this.logoFile,
        logoUrl: reader.result as string
      };

      await addDoc(collection(this.firestore, 'teams'), {
        city: newTeam.city,
        mascot: newTeam.mascot,
        logoUrl: newTeam.logoUrl
      });

      this.city = '';
      this.mascot = '';
      this.logoFile = null;
      await this.loadTeams();
    };

    reader.readAsDataURL(this.logoFile);
  }

  viewTeam(teamId: string) {
    this.router.navigate(['/teams', teamId]);
  }  

  async deleteTeam(id: string) {
    await deleteDoc(doc(this.firestore, `teams/${id}`));
    await this.loadTeams();
  }
}
