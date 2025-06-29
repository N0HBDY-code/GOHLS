import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth.service';
import { User } from 'firebase/auth';
import { Subscription, Observable } from 'rxjs';
import { Firestore, collection, getDocs, doc, getDoc, query, orderBy, limit, where } from '@angular/fire/firestore';

interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore?: number;
  awayScore?: number;
  time?: string;
  status?: string;
  week: number;
  day: string;
}

interface Transaction {
  id: string;
  type: 'trade' | 'signing' | 'retirement';
  title: string;
  details: string;
  timestamp: Date;
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  teamName?: string;
  createdDate: Date;
}

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  date: Date;
}

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
  
  // Dashboard data
  todaysGames: Game[] = [];
  recentTransactions: Transaction[] = [];
  newestPlayers: Player[] = [];
  leagueNews: NewsItem[] = [];
  
  // Stats
  totalPlayers = 0;
  totalTeams = 0;
  currentSeason = new Date().getFullYear();
  
  // Game lineup settings (controlled from headquarters)
  currentGameWeek = 1;
  currentGameDay = 'D1';
  
  loading = true;

  constructor(
    private authService: AuthService, 
    private firestore: Firestore
  ) {}

  async ngOnInit(): void {
    this.userSub = this.authService.currentUser.subscribe(user => {
      this.user = user;
    });

    await this.loadDashboardData();
    this.loading = false;
  }

  ngOnDestroy(): void {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
  }

  async loadDashboardData() {
    try {
      await Promise.all([
        this.loadGameLineup(),
        this.loadRecentTransactions(),
        this.loadNewestPlayers(),
        this.loadLeagueNews(),
        this.loadStats()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  async loadGameLineup() {
    try {
      // Load game lineup settings from headquarters
      const settingsRef = doc(this.firestore, 'gameSettings/current');
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        const settings = settingsSnap.data();
        this.currentGameWeek = settings['week'] || 1;
        this.currentGameDay = settings['day'] || 'D1';
      }

      // Load today's games based on current settings
      const gamesQuery = query(
        collection(this.firestore, 'games'),
        where('week', '==', this.currentGameWeek),
        where('day', '==', this.currentGameDay),
        where('season', '==', this.currentSeason)
      );
      
      const gamesSnap = await getDocs(gamesQuery);
      
      this.todaysGames = await Promise.all(
        gamesSnap.docs.map(async (gameDoc) => {
          const gameData = gameDoc.data();
          
          // Load team data for logos and names
          const [homeTeamSnap, awayTeamSnap] = await Promise.all([
            getDoc(doc(this.firestore, `teams/${gameData['homeTeamId']}`)),
            getDoc(doc(this.firestore, `teams/${gameData['awayTeamId']}`))
          ]);
          
          const homeTeamData = homeTeamSnap.exists() ? homeTeamSnap.data() : {};
          const awayTeamData = awayTeamSnap.exists() ? awayTeamSnap.data() : {};
          
          return {
            id: gameDoc.id,
            homeTeam: `${homeTeamData['city']} ${homeTeamData['mascot']}` || 'Unknown Team',
            awayTeam: `${awayTeamData['city']} ${awayTeamData['mascot']}` || 'Unknown Team',
            homeLogo: homeTeamData['logoUrl'],
            awayLogo: awayTeamData['logoUrl'],
            homeScore: gameData['homeScore'],
            awayScore: gameData['awayScore'],
            time: gameData['time'],
            status: gameData['status'] || 'Scheduled',
            week: gameData['week'],
            day: gameData['day']
          } as Game;
        })
      );
    } catch (error) {
      console.error('Error loading game lineup:', error);
      this.todaysGames = [];
    }
  }

  async loadRecentTransactions() {
    try {
      // Load recent player history entries for transactions
      const playersRef = collection(this.firestore, 'players');
      const playersSnap = await getDocs(playersRef);
      
      const allTransactions: Transaction[] = [];
      
      for (const playerDoc of playersSnap.docs) {
        const playerData = playerDoc.data();
        const historyRef = collection(this.firestore, `players/${playerDoc.id}/history`);
        const historyQuery = query(historyRef, orderBy('timestamp', 'desc'), limit(3));
        const historySnap = await getDocs(historyQuery);
        
        for (const historyDoc of historySnap.docs) {
          const historyData = historyDoc.data();
          const action = historyData['action'];
          
          if (['traded', 'signed', 'retired'].includes(action)) {
            let type: 'trade' | 'signing' | 'retirement';
            let title: string;
            let details: string;
            
            switch (action) {
              case 'traded':
                type = 'trade';
                title = `${playerData['firstName']} ${playerData['lastName']} Traded`;
                details = `Player moved to new team`;
                break;
              case 'signed':
                type = 'signing';
                title = `${playerData['firstName']} ${playerData['lastName']} Signed`;
                details = `Player joined the league`;
                break;
              case 'retired':
                type = 'retirement';
                title = `${playerData['firstName']} ${playerData['lastName']} Retired`;
                details = `Player announced retirement`;
                break;
              default:
                continue;
            }
            
            allTransactions.push({
              id: historyDoc.id,
              type,
              title,
              details,
              timestamp: historyData['timestamp']?.toDate() || new Date()
            });
          }
        }
      }
      
      // Sort by timestamp and take the 10 most recent
      this.recentTransactions = allTransactions
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);
        
    } catch (error) {
      console.error('Error loading recent transactions:', error);
      this.recentTransactions = [];
    }
  }

  async loadNewestPlayers() {
    try {
      const playersQuery = query(
        collection(this.firestore, 'players'),
        where('status', '==', 'active'),
        orderBy('createdDate', 'desc'),
        limit(5)
      );
      
      const playersSnap = await getDocs(playersQuery);
      
      this.newestPlayers = await Promise.all(
        playersSnap.docs.map(async (playerDoc) => {
          const playerData = playerDoc.data();
          let teamName = '';
          
          if (playerData['teamId'] && playerData['teamId'] !== 'none') {
            const teamSnap = await getDoc(doc(this.firestore, `teams/${playerData['teamId']}`));
            if (teamSnap.exists()) {
              const teamData = teamSnap.data();
              teamName = `${teamData['city']} ${teamData['mascot']}`;
            }
          }
          
          return {
            id: playerDoc.id,
            firstName: playerData['firstName'],
            lastName: playerData['lastName'],
            position: playerData['position'],
            teamName,
            createdDate: playerData['createdDate']?.toDate() || new Date()
          } as Player;
        })
      );
    } catch (error) {
      console.error('Error loading newest players:', error);
      this.newestPlayers = [];
    }
  }

  async loadLeagueNews() {
    try {
      // For now, create some sample news items
      // In a real implementation, this would come from a news collection
      this.leagueNews = [
        {
          id: '1',
          title: 'Season Playoffs Approaching',
          summary: 'Teams are making their final push for playoff positioning as we enter the final weeks of the regular season.',
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
        },
        {
          id: '2',
          title: 'New Player Registrations Open',
          summary: 'The league is now accepting new player registrations for the upcoming season. Submit your application today!',
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
        },
        {
          id: '3',
          title: 'Trade Deadline Extended',
          summary: 'Due to popular demand, the trade deadline has been extended by one week to allow teams more time to make moves.',
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
        }
      ];
    } catch (error) {
      console.error('Error loading league news:', error);
      this.leagueNews = [];
    }
  }

  async loadStats() {
    try {
      const [playersSnap, teamsSnap] = await Promise.all([
        getDocs(query(collection(this.firestore, 'players'), where('status', '==', 'active'))),
        getDocs(collection(this.firestore, 'teams'))
      ]);
      
      this.totalPlayers = playersSnap.docs.length;
      this.totalTeams = teamsSnap.docs.length;
    } catch (error) {
      console.error('Error loading stats:', error);
      this.totalPlayers = 0;
      this.totalTeams = 0;
    }
  }

  // Helper methods for styling
  getGameStatusClass(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'live':
      case 'in progress':
        return 'live';
      case 'final':
      case 'completed':
        return 'final';
      default:
        return 'scheduled';
    }
  }

  getTransactionIcon(type: string): string {
    switch (type) {
      case 'trade':
        return 'fas fa-exchange-alt';
      case 'signing':
        return 'fas fa-pen-nib';
      case 'retirement':
        return 'fas fa-medal';
      default:
        return 'fas fa-info-circle';
    }
  }

  getTransactionIconClass(type: string): string {
    return type;
  }

  getTransactionBadgeClass(type: string): string {
    switch (type) {
      case 'trade':
        return 'bg-primary';
      case 'signing':
        return 'bg-success';
      case 'retirement':
        return 'bg-warning';
      default:
        return 'bg-secondary';
    }
  }
}