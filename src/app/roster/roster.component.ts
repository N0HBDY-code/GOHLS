import { Component, Input, OnInit, NgZone } from '@angular/core';
import { Firestore, collection, addDoc, deleteDoc, doc, getDoc, getDocs, updateDoc, query, orderBy, limit, startAfter, DocumentData, QueryDocumentSnapshot } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { getDocsFromServer } from 'firebase/firestore';
import { setDoc } from 'firebase/firestore';

interface Player {
  id?: string;
  firstName: string;
  lastName: string;
  position: string;
  archetype?: string;
  expiration?: string;
  noTradeClause?: boolean;
  number: number;
  height?: string;
  weight?: string;
  handedness?: string;
  age?: number;
  rookie?: boolean;
  overall?: number;
  teamId: string;
  teamName?: string;
}

@Component({
  selector: 'app-roster',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roster.component.html',
  styleUrls: ['./roster.component.css']
})
export class RosterComponent implements OnInit {
  @Input() teamId!: string;

  players: Player[] = [];
  availablePlayers: Player[] = [];
  selectedPlayerId: string = '';
  lastPlayerDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  playerPageSize = 5;

  // Edit mode
  editModeId: string | null = null;
  editFirstName = '';
  editLastName = '';
  editPosition = '';
  editNumber: number | null = null;

  constructor(private firestore: Firestore, private ngZone: NgZone) {}

  async ngOnInit() {
    await this.loadPlayers();
    await this.loadAvailablePlayers();
  }

  async loadPlayers() {
    const rosterRef = collection(this.firestore, `teams/${this.teamId}/roster`);
    const q = query(rosterRef, orderBy('firstName'), limit(this.playerPageSize));
    const snapshot = await getDocs(q);
    this.players = await Promise.all(snapshot.docs.map(async docSnap => {
      const data = docSnap.data() as any;
      const player: Player = {
        id: docSnap.id,
        ...data,
        number: data.jerseyNumber // map jerseyNumber to number
      };

      if (data['teamId']) {
        const teamSnap = await getDoc(doc(this.firestore, `teams/${data['teamId']}`));
        player.teamName = teamSnap.exists() ? teamSnap.data()['name'] : 'Unknown';
      } else {
        const globalPlayerSnap = await getDoc(doc(this.firestore, `players/${docSnap.id}`));
        const globalData = globalPlayerSnap.data();
        if (globalData?.['teamId']) {
          const teamSnap = await getDoc(doc(this.firestore, `teams/${globalData['teamId']}`));
          player.teamId = globalData['teamId'];
          player.teamName = teamSnap.exists() ? teamSnap.data()['name'] : 'Unknown';
        } else {
          player.teamId = 'none';
        }
      }
      return player;
    }));
    this.lastPlayerDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  }

  async loadAvailablePlayers() {
    const allPlayersSnap = await getDocsFromServer(collection(this.firestore, 'players'));
    const rosterSnap = await getDocsFromServer(collection(this.firestore, `teams/${this.teamId}/roster`));

    const rosterIds = new Set(rosterSnap.docs.map(doc => doc.id));

    this.availablePlayers = allPlayersSnap.docs
      .filter(doc => {
        const data = doc.data() as any;
        return !rosterIds.has(doc.id) && (data.teamId === 'none' || !data.teamId);
      })
      .map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          ...data,
          number: data.jerseyNumber // map jerseyNumber to number
        } as Player;
      });
  }

  async loadNextPlayers() {
    if (!this.lastPlayerDoc) return;
    const rosterRef = collection(this.firestore, `teams/${this.teamId}/roster`);
    const q = query(rosterRef, orderBy('firstName'), startAfter(this.lastPlayerDoc), limit(this.playerPageSize));
    const snapshot = await getDocs(q);
    const nextPlayers = await Promise.all(snapshot.docs.map(async docSnap => {
      const data = docSnap.data() as any;
      const player: Player = {
        id: docSnap.id,
        ...data,
        number: data.jerseyNumber // map jerseyNumber to number
      };

      if (data['teamId']) {
        const teamSnap = await getDoc(doc(this.firestore, `teams/${data['teamId']}`));
        player.teamName = teamSnap.exists() ? teamSnap.data()['name'] : 'Unknown';
      } else {
        const globalPlayerSnap = await getDoc(doc(this.firestore, `players/${docSnap.id}`));
        const globalData = globalPlayerSnap.data();
        if (globalData?.['teamId']) {
          const teamSnap = await getDoc(doc(this.firestore, `teams/${globalData['teamId']}`));
          player.teamId = globalData['teamId'];
          player.teamName = teamSnap.exists() ? teamSnap.data()['name'] : 'Unknown';
        } else {
          player.teamId = 'none';
        }
      }
      return player;
    }));
    this.players = [...this.players, ...nextPlayers];
    this.lastPlayerDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  }

  async addPlayer() {
    const selected = this.availablePlayers.find(p => p.id === this.selectedPlayerId);
    if (!selected || !selected.id) return;

    const rosterDoc = doc(this.firestore, `teams/${this.teamId}/roster/${selected.id}`);
    await setDoc(rosterDoc, selected);

    const globalPlayerDoc = doc(this.firestore, `players/${selected.id}`);
    await updateDoc(globalPlayerDoc, {
      teamId: this.teamId
    });

    this.selectedPlayerId = '';
    this.ngZone.run(() => {
      this.loadPlayers();
      this.loadAvailablePlayers();
    });
  }

  async deletePlayer(playerId: string) {
    const playerDoc = doc(this.firestore, `teams/${this.teamId}/roster/${playerId}`);
    await deleteDoc(playerDoc);

    const globalPlayerDoc = doc(this.firestore, `players/${playerId}`);
    await updateDoc(globalPlayerDoc, { teamId: 'none' });

    this.players = this.players.filter(p => p.id !== playerId);
    this.availablePlayers = this.availablePlayers.filter(p => p.id !== playerId);

    await this.loadAvailablePlayers();
  }

  startEdit(player: Player) {
    this.editModeId = player.id!;
    this.editFirstName = player.firstName || '';
    this.editLastName = player.lastName || '';
    this.editPosition = player.position;
    this.editNumber = player.number;
  }

  cancelEdit() {
    this.editModeId = null;
    this.editFirstName = '';
    this.editLastName = '';
    this.editPosition = '';
    this.editNumber = null;
  }

  async updatePlayer() {
    if (!this.editModeId) return;
    const playerDoc = doc(this.firestore, `teams/${this.teamId}/roster/${this.editModeId}`);
    await updateDoc(playerDoc, {
      firstName: this.editFirstName,
      lastName: this.editLastName,
      position: this.editPosition,
      number: this.editNumber
    });
    this.cancelEdit();
    this.ngZone.run(() => {
      this.loadPlayers();
    });
  }
}
