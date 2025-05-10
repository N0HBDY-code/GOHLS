import { Component, Input, OnInit } from '@angular/core';
import { Firestore, collection, addDoc, deleteDoc, doc, getDocs, updateDoc, query, orderBy, limit, startAfter, DocumentData, QueryDocumentSnapshot } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface Player {
  id?: string;
  name: string;
  position: string;
  number: number;
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
  lastPlayerDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  playerPageSize = 5;

  // Add mode
  name = '';
  position = '';
  number: number | null = null;

  // Edit mode
  editModeId: string | null = null;
  editName = '';
  editPosition = '';
  editNumber: number | null = null;

  constructor(private firestore: Firestore) {}

  async ngOnInit() {
    await this.loadPlayers();
  }

  async loadPlayers() {
    const rosterRef = collection(this.firestore, `teams/${this.teamId}/roster`);
    const q = query(rosterRef, orderBy('name'), limit(this.playerPageSize));
    const snapshot = await getDocs(q);
    this.players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
    this.lastPlayerDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  }

  async loadNextPlayers() {
    if (!this.lastPlayerDoc) return;
    const rosterRef = collection(this.firestore, `teams/${this.teamId}/roster`);
    const q = query(rosterRef, orderBy('name'), startAfter(this.lastPlayerDoc), limit(this.playerPageSize));
    const snapshot = await getDocs(q);
    const nextPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
    this.players = [...this.players, ...nextPlayers];
    this.lastPlayerDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  }

  async addPlayer() {
    if (!this.name || !this.position || this.number === null) return;
    const player = { name: this.name, position: this.position, number: this.number };
    const rosterRef = collection(this.firestore, `teams/${this.teamId}/roster`);
    await addDoc(rosterRef, player);
    this.name = '';
    this.position = '';
    this.number = null;
    await this.loadPlayers();
  }

  async deletePlayer(playerId: string) {
    const playerDoc = doc(this.firestore, `teams/${this.teamId}/roster/${playerId}`);
    await deleteDoc(playerDoc);
    await this.loadPlayers();
  }

  startEdit(player: Player) {
    this.editModeId = player.id!;
    this.editName = player.name;
    this.editPosition = player.position;
    this.editNumber = player.number;
  }

  cancelEdit() {
    this.editModeId = null;
    this.editName = '';
    this.editPosition = '';
    this.editNumber = null;
  }

  async updatePlayer() {
    if (!this.editModeId) return;
    const playerDoc = doc(this.firestore, `teams/${this.teamId}/roster/${this.editModeId}`);
    await updateDoc(playerDoc, {
      name: this.editName,
      position: this.editPosition,
      number: this.editNumber
    });
    this.cancelEdit();
    await this.loadPlayers();
  }
}