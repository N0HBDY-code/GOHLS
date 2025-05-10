import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, getDocs, updateDoc, doc, CollectionReference, DocumentData } from '@angular/fire/firestore';

interface Team {
  id: string;
  name: string;
}

interface Player {
  id: string;
  name: string;
  number: string;
  position: string;
}

interface ProgressionData {
  training: string;
  status: string;
}

interface RosterEntry extends Player {
  progression: string;
  status: string;
  progressionDocId: string | null;
}

@Component({
  selector: 'app-progression-tracker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './progression-tracker.component.html',
  styleUrls: ['./progression-tracker.component.css']
})
export class ProgressionTrackerComponent implements OnInit {
  private firestore = inject(Firestore);

  teams: Team[] = [];
  selectedTeamId: string = '';
  roster: RosterEntry[] = [];
  loading = false;

  async ngOnInit() {
    const snapshot = await getDocs(collection(this.firestore, 'teams'));
    this.teams = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data()['name'] || 'Unnamed'
    }));
  }

  async loadRoster() {
    if (!this.selectedTeamId) return;
    this.loading = true;
    this.roster = [];

    const rosterRef = collection(this.firestore, `teams/${this.selectedTeamId}/roster`) as CollectionReference<DocumentData>;
    const playersSnap = await getDocs(rosterRef);

    for (const playerDoc of playersSnap.docs) {
      const playerData = playerDoc.data() as Player;

      const progressionSnap = await getDocs(
        collection(this.firestore, `teams/${this.selectedTeamId}/roster/${playerDoc.id}/progression`)
      );

      const progressionData = progressionSnap.docs[0]?.data() as ProgressionData | undefined;
      const progressionDocId = progressionSnap.docs[0]?.id || null;

      this.roster.push({
        id: playerDoc.id,
        name: playerData.name,
        number: playerData.number,
        position: playerData.position,
        progression: progressionData?.training || 'Not submitted',
        status: progressionData?.status || 'N/A',
        progressionDocId
      });
    }

    this.loading = false;
  }

  async markAsProcessed(playerId: string, docId: string) {
    if (!this.selectedTeamId || !docId) return;
    const progressionRef = doc(this.firestore, `teams/${this.selectedTeamId}/roster/${playerId}/progression/${docId}`);
    await updateDoc(progressionRef, { status: 'processed' });
    await this.loadRoster();
  }
}
