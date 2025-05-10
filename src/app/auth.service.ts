import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { map } from 'rxjs/operators';

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

  private rolesSubject = new BehaviorSubject<string[]>([]);
  public currentRoles = this.rolesSubject.asObservable();

  private viewAsRoleSubject = new BehaviorSubject<string | null>(null);
  public viewAsRole$ = this.viewAsRoleSubject.asObservable();

  public effectiveRoles = combineLatest([
    this.currentRoles,
    this.viewAsRole$
  ]).pipe(
    map(([roles, viewAs]) => viewAs ? [viewAs] : roles)
  );

  constructor(private auth: Auth, private firestore: Firestore) {
    onAuthStateChanged(this.auth, async (user) => {
      this.userSubject.next(user);

      if (user) {
        const snapshot = await getDoc(doc(this.firestore, 'users', user.uid));
        const data = snapshot.data();
        const roles = Array.isArray(data?.['roles']) ? data['roles'] : [];
        this.rolesSubject.next(roles);
      } else {
        this.rolesSubject.next([]);
      }
    });
  }

  setViewAsRole(role: string | null) {
    console.log('Switching view to:', role); // debug
    this.viewAsRoleSubject.next(role);
  }

  async register(userInfo: UserInfo) {
    const userCred = await createUserWithEmailAndPassword(this.auth, userInfo.email, userInfo.password);
    await updateProfile(userCred.user, {
      displayName: `${userInfo.fname} ${userInfo.lname}`
    });

    await setDoc(doc(this.firestore, 'users', userCred.user.uid), {
      uid: userCred.user.uid,
      displayName: `${userInfo.fname} ${userInfo.lname}`,
      email: userInfo.email,
      roles: ['viewer'] // default role
    });

    this.userSubject.next(userCred.user);
    this.rolesSubject.next(['viewer']);
    return userCred.user;
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password).then(async userCredential => {
      this.userSubject.next(userCredential.user);

      const snapshot = await getDoc(doc(this.firestore, 'users', userCredential.user.uid));
      const data = snapshot.data();
      const roles = Array.isArray(data?.['roles']) ? data['roles'] : [];
      this.rolesSubject.next(roles);

      return userCredential.user;
    });
  }

  forgotPassword(email: string) {
    return sendPasswordResetEmail(this.auth, email);
  }

  logout() {
    this.userSubject.next(null);
    this.rolesSubject.next([]);
    this.viewAsRoleSubject.next(null);
    return signOut(this.auth);
  }

  signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this.auth, provider).then(async (result) => {
      const user = result.user;
      this.userSubject.next(user);

      const userDoc = doc(this.firestore, 'users', user.uid);
      const snapshot = await getDoc(userDoc);

      if (!snapshot.exists()) {
        await setDoc(userDoc, {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          roles: ['viewer']
        });
        this.rolesSubject.next(['viewer']);
      } else {
        const data = snapshot.data();
        const roles = Array.isArray(data?.['roles']) ? data['roles'] : [];
        this.rolesSubject.next(roles);
      }

      return user;
    });
  }
}
