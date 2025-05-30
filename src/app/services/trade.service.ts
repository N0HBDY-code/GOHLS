import { Injectable } from '@angular/core';
import { Firestore, doc, updateDoc, collection, addDoc, getDocs, query, where, DocumentReference, writeBatch } from '@angular/fire/firestore';

export interface TradeOffer {
  id?: string;
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

  async proposeTrade(offer: Omit<TradeOffer, 'status' | 'timestamp' | 'id'>) {
    const tradeData: Omit<TradeOffer, 'id'> = {
      ...offer,
      status: 'pending',
      timestamp: new Date()
    };

    await addDoc(collection(this.firestore, 'tradeOffers'), tradeData);
  }

  async getTradeOffersForTeam(teamId: string): Promise<TradeOffer[]> {
    const offersRef = collection(this.firestore, 'tradeOffers');
    const q = query(offersRef, where('toTeamId', '==', teamId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ 
      id: doc.id,
      ...doc.data() as Omit<TradeOffer, 'id'>
    }));
  }

  async acceptTrade(tradeOffer: TradeOffer) {
    const batch = writeBatch(this.firestore);

    // Update trade offer status
    if (tradeOffer.id) {
      const tradeRef = doc(this.firestore, `tradeOffers/${tradeOffer.id}`);
      batch.update(tradeRef, { status: 'accepted' });
    }

    // Process offered players if any exist
    if (tradeOffer.playersOffered.length > 0) {
      for (const playerId of tradeOffer.playersOffered) {
        await this.addPlayerToBatch(batch, playerId, tradeOffer.fromTeamId, tradeOffer.toTeamId);
      }
    }

    // Process requested players if any exist
    if (tradeOffer.playersRequested.length > 0) {
      for (const playerId of tradeOffer.playersRequested) {
        await this.addPlayerToBatch(batch, playerId, tradeOffer.toTeamId, tradeOffer.fromTeamId);
      }
    }

    // Commit all changes in a single batch
    await batch.commit();
  }

  async rejectTrade(tradeOffer: TradeOffer) {
    if (tradeOffer.id) {
      const tradeRef = doc(this.firestore, `tradeOffers/${tradeOffer.id}`);
      await updateDoc(tradeRef, { status: 'rejected' });
    }
  }

  private async addPlayerToBatch(batch: any, playerId: string, fromTeamId: string, toTeamId: string) {
    // Get player data from the old team's roster
    const oldTeamRosterRef = doc(this.firestore, `teams/${fromTeamId}/roster/${playerId}`);
    const oldTeamRosterSnap = await getDoc(oldTeamRosterRef);
    
    if (!oldTeamRosterSnap.exists()) {
      console.warn(`Player ${playerId} not found in team ${fromTeamId}'s roster`);
      return;
    }

    const playerData = oldTeamRosterSnap.data();
    const playerRef = doc(this.firestore, `players/${playerId}`);
    const newTeamRosterRef = doc(this.firestore, `teams/${toTeamId}/roster/${playerId}`);

    // Update player's team ID
    batch.update(playerRef, { teamId: toTeamId });
    
    // Remove from old team
    batch.delete(oldTeamRosterRef);
    
    // Add to new team
    batch.set(newTeamRosterRef, { ...playerData, teamId: toTeamId });
  }
}