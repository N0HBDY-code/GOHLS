import { Component, OnInit } from '@angular/core';
import {
  Firestore,
  collection,
  getDocs,
  addDoc,
  doc,
  query,
  where,
  deleteDoc
} from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ... (keep all existing interfaces)

@Component({
  selector: 'app-games',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './games.component.html',
  styleUrl: './games.component.css'
})
export class GamesComponent implements OnInit {
  // ... (keep all existing properties)

  isClearing = false;

  constructor(private firestore: Firestore) {}

  // ... (keep all existing methods)

  async clearAllGames() {
    if (!confirm('Are you sure you want to delete ALL games? This cannot be undone!')) {
      return;
    }

    this.isClearing = true;
    try {
      for (const team of this.teams) {
        const gamesRef = collection(this.firestore, `teams/${team.id}/games`);
        const snapshot = await getDocs(gamesRef);
        
        for (const doc of snapshot.docs) {
          await deleteDoc(doc.ref);
        }
      }
      
      // Reload games after clearing
      this.allGames = [];
      this.filteredGames = [];
      this.calendarDays = [];
      await this.loadAllGames();
      
      alert('All games have been cleared successfully!');
    } catch (error) {
      console.error('Error clearing games:', error);
      alert('Error clearing games. Please check the console for details.');
    } finally {
      this.isClearing = false;
    }
  }
}