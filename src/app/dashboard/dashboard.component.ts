
import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth.service';
import { User } from 'firebase/auth';
import { Subscription, Observable } from 'rxjs';
import { Firestore, collection, getDocs, doc, getDoc } from '@angular/fire/firestore';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  user: User | null = null;
  private userSub!: Subscription;
  games$: Observable<any[]> = new Observable();
  today: Date = new Date();

  constructor(private authService: AuthService, private firestore: Firestore) {}

  ngOnInit(): void {
    this.userSub = this.authService.currentUser.subscribe(user => {
      this.user = user;
    });

    this.loadGamesWithScores();
  }

  ngOnDestroy(): void {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
  }

  async loadGamesWithScores() {
    const gamesRef = collection(this.firestore, 'games');
    const snap = await getDocs(gamesRef);
    const games = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const enrichedGames = await this.enrichGamesWithScore(games);
    this.games$ = new Observable((observer) => observer.next(enrichedGames));
  }

  async enrichGamesWithScore(games: any[]): Promise<any[]> {
    const enriched = await Promise.all(
      games.map(async (game) => {
        const gameDocRef = doc(this.firestore, 'games', game.id);
        const gameDocSnap = await getDoc(gameDocRef);

        const data = gameDocSnap.data();
        console.log('Fetched game data:', data);

        if (!data || !data['stats']) {
          return { ...game, totalPoints: 0 };
        }

        const playerStats = Object.values(data['stats']);
        console.log('Stats object for game', game.id, ':', playerStats);

        const totalPoints = playerStats.reduce((sum: number, stat: any) => {
          const pts = typeof stat === 'object' && 'points' in stat ? stat.points : 0;
          return sum + (typeof pts === 'number' ? pts : 0);
        }, 0);

        return { ...game, totalPoints };
      })
    );

    return enriched;
  }
}