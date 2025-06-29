import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  collection,
  getDocs,
  updateDoc,
  doc,
  CollectionReference,
  getDoc,
  setDoc,
  addDoc,
  query,
  where
} from '@angular/fire/firestore';
import { ProgressionService } from '../services/progression.service';
import { getDefaultAttributes } from '../services/progression-defaults';

@Component({
  selector: 'app-progression-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './progression-tracker.component.html',
  styleUrls: ['./progression-tracker.component.css']
})
export class ProgressionTrackerComponent implements OnInit {
  private firestore = inject(Firestore);
  private progressionService = inject(ProgressionService);

  teams: { id: string, name: string, logoUrl?: string }[] = [];
  selectedTeamId: string = '';
  roster: any[] = [];
  loading = false;

  // Current progression settings (what players see)
  currentProgressionWeek: number = 1;
  progressionsOpen: boolean = true;
  progressionWeeks: number[] = Array.from({ length: 20 }, (_, i) => i + 1);

  // Management view settings (what progression tracker sees)
  viewingWeek: number = 1;
  viewingWeeks: number[] = Array.from({ length: 20 }, (_, i) => i + 1);
  currentSeason: number = new Date().getFullYear();

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

  showAddTeamModal = false;
  selectedConference: string = '';
  selectedDivision: string = '';
  newTeam = { city: '', mascot: '', logoUrl: '' };

  async ngOnInit() {
    await this.loadProgressionSettings();
    this.viewingWeek = this.currentProgressionWeek; // Default to current week

    const snapshot = await getDocs(collection(this.firestore, 'teams'));
    this.teams = snapshot.docs.map(doc => {
      const data = doc.data();
      const name = data['name'] || `${data['city'] || ''} ${data['mascot'] || ''}`.trim() || 'Unnamed';
      return { id: doc.id, name, logoUrl: data['logoUrl'] || '' };
    });
  }

  get selectedTeam() {
    return this.teams.find(t => t.id === this.selectedTeamId);
  }

  async loadRoster() {
    if (!this.selectedTeamId) {
      this.roster = [];
      return;
    }

    this.loading = true;
    this.roster = [];

    const rosterRef = collection(this.firestore, `teams/${this.selectedTeamId}/roster`) as CollectionReference;
    const playersSnap = await getDocs(rosterRef);

    const playerDocs = playersSnap.docs;
    for (const playerDoc of playerDocs) {
      const data = playerDoc.data();
      
      // Load progression data for the viewing week (not current week)
      const progressionQuery = query(
        collection(this.firestore, `players/${playerDoc.id}/progressions`),
        where('week', '==', this.viewingWeek),
        where('season', '==', this.currentSeason)
      );
      const progressionSnap = await getDocs(progressionQuery);
      const progression = progressionSnap.docs[0]?.data();

      const globalPlayerRef = doc(this.firestore, `players/${playerDoc.id}`);
      const globalPlayerSnap = await getDoc(globalPlayerRef);
      const globalPlayerData = globalPlayerSnap.exists() ? globalPlayerSnap.data() : {};

      const attributesRef = doc(this.firestore, `players/${playerDoc.id}/meta/attributes`);
      const attributesSnap = await getDoc(attributesRef);
      if (!attributesSnap.exists()) {
        await setDoc(attributesRef, getDefaultAttributes(data['position']));
      }

      this.roster.push({
        id: playerDoc.id,
        name: `${data['firstName']} ${data['lastName']}`,
        number: data['jerseyNumber'],
        position: data['position'],
        age: globalPlayerData['age'] || 19,
        progression: progression?.['training'] || 'Not submitted',
        status: progression?.['status'] || 'N/A',
        progressionDocId: progressionSnap.docs[0]?.id || null,
        overall: globalPlayerData['overall'] ?? 'N/A'
      });
    }

    this.loading = false;
  }

  async onViewingWeekChange() {
    console.log(`📅 Viewing week changed to: ${this.viewingWeek}`);
    if (this.selectedTeamId) {
      await this.loadRoster();
    }
  }

  async markAsProcessed(playerId: string, docId: string) {
    if (!this.selectedTeamId || !docId) return;

    // Update both player and team progression records
    const playerProgressionRef = doc(this.firestore, `players/${playerId}/progressions/${docId}`);
    await updateDoc(playerProgressionRef, { status: 'processed' });

    // Also update team roster progression if it exists
    const teamProgressionRef = doc(this.firestore, `teams/${this.selectedTeamId}/roster/${playerId}/progression/${docId}`);
    try {
      await updateDoc(teamProgressionRef, { status: 'processed' });
    } catch (error) {
      console.log('Team progression record not found, skipping update');
    }

    // Get progression details for applying changes
    const progressionSnap = await getDoc(playerProgressionRef);
    const training = progressionSnap.data()?.['training'];

    const playerSnap = await getDoc(doc(this.firestore, `players/${playerId}`));
    const age = playerSnap.data()?.['age'] || 19;

    // Apply progression using the specific week
    await this.progressionService.applyProgression(playerId, training, age, this.viewingWeek);

    await this.loadRoster();
  }

  async undoProcessed(playerId: string, docId: string) {
    if (!this.selectedTeamId || !docId) return;

    // Get progression details before undoing
    const playerProgressionRef = doc(this.firestore, `players/${playerId}/progressions/${docId}`);
    const progressionSnap = await getDoc(playerProgressionRef);
    const training = progressionSnap.data()?.['training'];

    const playerSnap = await getDoc(doc(this.firestore, `players/${playerId}`));
    const age = playerSnap.data()?.['age'] || 19;

    // Undo the progression changes
    await this.progressionService.undoProgression(playerId, training, age, this.viewingWeek);

    // Update status back to pending
    await updateDoc(playerProgressionRef, { status: 'pending' });

    // Also update team roster progression if it exists
    const teamProgressionRef = doc(this.firestore, `teams/${this.selectedTeamId}/roster/${playerId}/progression/${docId}`);
    try {
      await updateDoc(teamProgressionRef, { status: 'pending' });
    } catch (error) {
      console.log('Team progression record not found, skipping update');
    }

    await this.loadRoster();
  }

  selectedPlayerAttributes: Record<string, number> = {};
  affectedAttributes: string[] = [];
  showAttributesPlayerId: string | null = null;
  objectKeys = Object.keys;

  async showAttributes(playerId: string, training: string) {
    if (this.showAttributesPlayerId === playerId) {
      this.showAttributesPlayerId = null;
      this.selectedPlayerAttributes = {};
      this.affectedAttributes = [];
      return;
    }

    this.showAttributesPlayerId = playerId;

    const attrRef = doc(this.firestore, `players/${playerId}/meta/attributes`);
    const attrSnap = await getDoc(attrRef);
    this.selectedPlayerAttributes = attrSnap.exists() ? attrSnap.data() as Record<string, number> : {};

    this.affectedAttributes = this.progressionService.getAffectedAttributes(training);
  }

  attributeDisplayOrder: string[] = [
    "SPEED", "BODY CHK", "ENDUR", "PK CTRL", "PASSING", "SHT/PSS",
    "SLAP PWR", "SLAP ACC", "WRI PWR", "WRI ACC", "AGILITY", "STRENGTH",
    "ACCEL", "BALANCE", "FACEOFF", "DRBLTY", "DEKE", "AGGRE", "POISE",
    "HND EYE", "SHT BLK", "OFF AWR", "DEF AWR", "DISCIP", "FIGHTING",
    "STK CHK", "SAVED"
  ];

  getPlayerNameById(playerId: string): string {
    const player = this.roster.find(p => p.id === playerId);
    return player ? player.name : 'Player';
  }

  async loadProgressionSettings() {
    const settingsRef = doc(this.firestore, 'progressionSettings/config');
    const snap = await getDoc(settingsRef);

    if (snap.exists()) {
      const data = snap.data();
      this.currentProgressionWeek = data['week'] ?? 1;
      this.progressionsOpen = data['open'] ?? true;
    } else {
      this.currentProgressionWeek = 1;
      this.progressionsOpen = true;
      await setDoc(settingsRef, {
        week: this.currentProgressionWeek,
        open: this.progressionsOpen
      });
    }
  }

  async updateCurrentProgressionSettings() {
    const settingsRef = doc(this.firestore, 'progressionSettings/config');
    const previousWeek = this.currentProgressionWeek;
    
    await setDoc(settingsRef, {
      week: this.currentProgressionWeek,
      open: this.progressionsOpen
    }, { merge: true });

    // If week changed, emit event for player components
    if (previousWeek !== this.currentProgressionWeek) {
      console.log(`📅 Current progression week changed from ${previousWeek} to ${this.currentProgressionWeek}`);
      
      window.dispatchEvent(new CustomEvent('weekChanged', {
        detail: {
          previousWeek: previousWeek,
          newWeek: this.currentProgressionWeek
        }
      }));

      // Update viewing week to match current week by default
      this.viewingWeek = this.currentProgressionWeek;
      
      // Reload roster if team is selected
      if (this.selectedTeamId) {
        await this.loadRoster();
      }
    }
  }

  openAddTeamModal(conference: string, division: string) {
    this.selectedConference = conference;
    this.selectedDivision = division;
    this.newTeam = { city: '', mascot: '', logoUrl: '' };
    this.showAddTeamModal = true;
  }

  async addTeam() {
    const name = `${this.newTeam.city} ${this.newTeam.mascot}`;
    const newTeamDoc = {
      city: this.newTeam.city,
      mascot: this.newTeam.mascot,
      logoUrl: this.newTeam.logoUrl,
      name,
      conference: this.selectedConference,
      division: this.selectedDivision
    };

    const teamRef = await addDoc(collection(this.firestore, 'teams'), newTeamDoc);
    this.teams.push({ id: teamRef.id, name, logoUrl: this.newTeam.logoUrl });
    this.showAddTeamModal = false;
  }
}