import { Injectable } from '@angular/core';
import { Firestore, doc, getDoc, updateDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class ProgressionService {
  constructor(private firestore: Firestore) {}

  private trainingMap: Record<string, string[]> = {
    'Speed Skating': ['SPEED', 'ACCEL', 'AGILITY'],
    'Distance Skating': ['ENDUR', 'BALANCE', 'DRBLTY'],
    'Stick Handling': ['PK CTRL', 'DEKE', 'HND EYE'],
    'MMA': ['BODY CHK', 'STRENGTH', 'AGGRE', 'FIGHTING'],
    'Marksmanship': ['WRI PWR', 'SLAP PWR', 'PASSING'],
    'Hit the Targets': ['WRI ACC', 'SLAP ACC', 'POISE'],
    'Study Film': ['OFF AWR', 'DEF AWR', 'DISCIP'],
    'Special Teams': ['STK CHK', 'SHT BLK', 'FACEOFF'],
    'Shots High': ['GLV HIGH', 'STK HIGH', 'VISION'],
    'Shots Low': ['GLV LOW', 'STK LOW', '5 HOLE'],
    'Side to Sides': ['SPEED', 'AGILITY', 'POISE'],
    'Puck Skills': ['PK CTRL', 'PASSING', 'PK PL FRQ'],
    'Laps in Pads': ['ENDUR', 'DRBLTY', 'AGGRE'],
    'Positioning': ['BRK AWAY', 'ANGLES'],
    'Under Pressure': ['RBD CTRL', 'RECOV']
  };

  private getAttributeDelta(age: number, week: number): number {
    if (age <= 26) return week <= 5 ? 3 : 2;
    if (age <= 29) return 1;
    if (age === 30) return 1;
    if (age === 31) return -1;
    if (age === 32) return -2;
    if (age === 33) return -2;
    return -3;
  }

  async applyProgression(playerId: string, training: string, age: number, week: number) {
    const attrRef = doc(this.firestore, `players/${playerId}/meta/attributes`);
    const attrSnap = await getDoc(attrRef);
    if (!attrSnap.exists()) return;

    const attributes = attrSnap.data();
    const fields = this.trainingMap[training];
    if (!fields) return; // Skip if training not found

    const delta = this.getAttributeDelta(age, week);

    const updatedAttributes: Record<string, any> = {};

    for (const attr of fields) {
      const current = attributes[attr] || 0;
      // Ensure attributes stay within bounds (40-99)
      updatedAttributes[attr] = Math.max(40, Math.min(99, current + delta));
    }

    await updateDoc(attrRef, updatedAttributes);
  }

  async undoProgression(playerId: string, training: string, age: number, week: number) {
    const attrRef = doc(this.firestore, `players/${playerId}/meta/attributes`);
    const attrSnap = await getDoc(attrRef);
    if (!attrSnap.exists()) return;

    const attributes = attrSnap.data();
    const fields = this.trainingMap[training];
    if (!fields) return; // Skip if training not found

    const delta = this.getAttributeDelta(age, week);

    const updatedAttributes: Record<string, any> = {};

    for (const attr of fields) {
      const current = attributes[attr] || 0;
      // Ensure attributes stay within bounds (40-99)
      updatedAttributes[attr] = Math.max(40, Math.min(99, current - delta));
    }

    await updateDoc(attrRef, updatedAttributes);
  }

  getAffectedAttributes(training: string): string[] {
    return this.trainingMap[training] || [];
  }
}