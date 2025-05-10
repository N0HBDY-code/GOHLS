import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  getDoc
} from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

export interface UserInfo {
  fname: string;
  lname: string;
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public currentUser = this.userSubject.asObservable();

  private roleSubject = new BehaviorSubject<string>('viewer');
  public currentRole = this.roleSubject.asObservable();

  constructor(private auth: Auth, private firestore: Firestore) {
    onAuthStateChanged(this.auth, async (user) => {
      this.userSubject.next(user);

      if (user) {
        const snapshot = await getDoc(doc(this.firestore, 'users', user.uid));
        const data = snapshot.data() as { role?: string };
        this.roleSubject.next(data?.role || 'viewer');
      } else {
        this.roleSubject.next('viewer');
      }
    });
  }

  register(userInfo: UserInfo) {
    return createUserWithEmailAndPassword(this.auth, userInfo.email, userInfo.password)
      .then(async (userCredential) => {
        await updateProfile(userCredential.user, {
          displayName: `${userInfo.fname} ${userInfo.lname}`
        });

        await setDoc(doc(this.firestore, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userInfo.email,
          displayName: `${userInfo.fname} ${userInfo.lname}`,
          role: 'viewer' // default role
        });

        this.userSubject.next(userCredential.user);
        this.roleSubject.next('viewer');
        return userCredential.user;
      });
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password).then(async userCredential => {
      this.userSubject.next(userCredential.user);

      const userDoc = doc(this.firestore, 'users', userCredential.user.uid);
      const snapshot = await getDoc(userDoc);
      const data = snapshot.data() as { role?: string };
      this.roleSubject.next(data?.role || 'viewer');

      return userCredential.user;
    });
  }

  forgotPassword(email: string) {
    return sendPasswordResetEmail(this.auth, email);
  }

  logout() {
    this.userSubject.next(null);
    this.roleSubject.next('viewer');
    return signOut(this.auth);
  }

  signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this.auth, provider).then(async (result) => {
      const user = result.user;
      this.userSubject.next(user);

      const userDocRef = doc(this.firestore, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);

      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: 'viewer'
        });
      }

      const data = (await getDoc(userDocRef)).data() as { role?: string };
      this.roleSubject.next(data?.role || 'viewer');

      return user;
    });
  }
}
