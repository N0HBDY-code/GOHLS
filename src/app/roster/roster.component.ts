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
  attributes?: PlayerAttributes;
  salary?: number;
  contractYears?: number;
  capHit?: number;
  signingBonus?: number;
  performanceBonus?: number;
}

interface PlayerAttributes {
  speed: number;
  shooting: number;
  passing: number;
  checking: number;
  defense: number;
  faceoffs: number;
  awareness: number;
  durability: number;
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
  currentView: 'general' | 'attributes' | 'finances' = 'general';
  teamCapSpace: number = 82500000; // Example cap space

  constructor(private firestore: Firestore, private ngZone: NgZone) {}

  async ngOnInit() {
    await this.loadPlayers();
    await this.loadAvailablePlayers();
  }

  formatCurrency(amount: number = 0): string {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
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
        number: data.jerseyNumber
      };

      // Load attributes
      const attributesSnap = await getDoc(doc(this.firestore, `players/${docSnap.id}/meta/attributes`));
      if (attributesSnap.exists()) {
        player.attributes = attributesSnap.data() as PlayerAttributes;
      }

      // Load contract info
      const contractSnap = await getDoc(doc(this.firestore, `players/${docSnap.id}/meta/contract`));
      if (contractSnap.exists()) {
        const contractData = contractSnap.data();
        player.salary = contractData['salary'];
        player.contractYears = contractData['years'];
        player.capHit = contractData['capHit'];
        player.signingBonus = contractData['signingBonus'];
        player.performanceBonus = contractData['performanceBonus'];
      }

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
          number: data.jerseyNumber
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
        number: data.jerseyNumber
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
}