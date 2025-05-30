import { Injectable } from '@angular/core';
import { Firestore, doc, updateDoc, collection, addDoc, getDocs, query, where } from '@angular/fire/firestore';

export interface TradeOffer {
  fromTeamId: string;
  toTeamId: string;
  playersOffered: string[];
  playersRequested: string[];
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class TradeService {
  constructor(private firestore: Firestore) {}

  async proposeTrade(offer: Omit<TradeOffer, 'status' | 'timestamp'>) {
    const tradeData: TradeOffer = {
      ...offer,
      status: 'pending',
      timestamp: new Date()
    };

    await addDoc(collection(this.firestore, 'tradeOffers'), tradeData);
  }

  async getTradeOffersForTeam(teamId: string) {
    const offersRef = collection(this.firestore, 'tradeOffers');
    const q = query(offersRef, where('toTeamId', '==', teamId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async acceptTrade(tradeOffer: TradeOffer) {
    // Move players from team to team
    for (const playerId of tradeOffer.playersOffered) {
      await this.movePlayer(playerId, tradeOffer.fromTeamId, tradeOffer.toTeamId);
    }

    for (const playerId of tradeOffer.playersRequested) {
      await this.movePlayer(playerId, tradeOffer.toTeamId, tradeOffer.fromTeamId);
    }
  }

  private async movePlayer(playerId: string, fromTeamId: string, toTeamId: string) {
    // Get player data from old team
    const oldTeamRosterRef = doc(this.firestore, `teams/${fromTeamId}/roster/${playerId}`);
    const playerSnap = await getDocs(collection(this.firestore, `teams/${fromTeamId}/roster`));
    const playerData = playerSnap.docs.find(doc => doc.id === playerId)?.data();

    if (!playerData) return;

    // Add to new team
    const newTeamRosterRef = doc(this.firestore, `teams/${toTeamId}/roster/${playerId}`);
    await updateDoc(newTeamRosterRef, playerData);

    // Update player's team ID
    const playerRef = doc(this.firestore, `players/${playerId}`);
    await updateDoc(playerRef, { teamId: toTeamId });

    // Remove from old team
    await updateDoc(oldTeamRosterRef, { teamId: toTeamId });
  }
}