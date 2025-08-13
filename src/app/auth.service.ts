import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User,
  setPersistence,
  browserLocalPersistence,
  connectAuthEmulator
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { BehaviorSubject, combineLatest, firstValueFrom, timer } from 'rxjs';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { map, switchMap, take } from 'rxjs/operators';

export interface UserInfo {
  username: string;
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public currentUser = this.userSubject.asObservable();

  private authInitialized = new BehaviorSubject<boolean>(false);
  public authInitialized$ = this.authInitialized.asObservable();

  private authStateResolved = new BehaviorSubject<boolean>(false);
  public authStateResolved$ = this.authStateResolved.asObservable();

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
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      // Set persistence to local storage for 1 hour sessions
      await setPersistence(this.auth, browserLocalPersistence);
      
      // Set up auth state listener with proper initialization
      let isFirstStateChange = true;
      
      onAuthStateChanged(this.auth, async (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        
        this.userSubject.next(user);

        if (user) {
          // Load user roles
          const snapshot = await getDoc(doc(this.firestore, 'users', user.uid));
          const data = snapshot.data();
          const roles = Array.isArray(data?.['roles']) ? data['roles'] : [];
          this.rolesSubject.next(roles);
        } else {
          this.rolesSubject.next([]);
        }
        
        // Mark auth as initialized after first state change
        if (isFirstStateChange) {
          this.authInitialized.next(true);
          // Add a small delay to ensure everything is properly set up
          setTimeout(() => {
            this.authStateResolved.next(true);
          }, 100);
          isFirstStateChange = false;
        }
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      // Fallback: mark as initialized even if there's an error
      this.authInitialized.next(true);
      this.authStateResolved.next(true);
    }
  }

  // Enhanced method to wait for auth initialization with timeout
  async waitForAuthInit(): Promise<boolean> {
    return new Promise((resolve) => {
      // Set a maximum wait time of 3 seconds
      const timeout = setTimeout(() => {
        console.log('Auth initialization timeout reached');
        resolve(false);
      }, 3000);

      // Wait for auth state to be resolved
      this.authStateResolved$.pipe(take(1)).subscribe(resolved => {
        if (resolved) {
          clearTimeout(timeout);
          resolve(true);
        }
      });
    });
  }

  // Method to check if user is currently authenticated
  isAuthenticated(): boolean {
    return !!this.userSubject.value;
  }

  // Method to get current user synchronously
  getCurrentUser(): User | null {
    return this.userSubject.value;
  }
    
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
      
      // Mark auth as initialized after first state change
      this.authInitialized.next(true);
    });
  }

  // Method to wait for auth initialization
  async waitForAuthInit(): Promise<void> {
    return firstValueFrom(this.authInitialized$.pipe(
      map(initialized => {
        if (initialized) return;
        throw new Error('Auth not initialized');
      })
    )).catch(() => {
      // If auth doesn't initialize within reasonable time, continue anyway
    });
  }

  setViewAsRole(role: string | null) {
    this.viewAsRoleSubject.next(role);
  }

  async register(userInfo: UserInfo) {
    const userCred = await createUserWithEmailAndPassword(this.auth, userInfo.email, userInfo.password);
    await updateProfile(userCred.user, {
      displayName: userInfo.username
    });

    await setDoc(doc(this.firestore, 'users', userCred.user.uid), {
      uid: userCred.user.uid,
      displayName: userInfo.username,
      email: userInfo.email,
      roles: ['viewer'] // default role
    });

    this.userSubject.next(userCred.user);
    this.rolesSubject.next(['viewer']);
    return userCred.user;
  }

  login(username: string, password: string) {
    // First get the email associated with the username
    return this.getUserEmailByUsername(username).then(email => {
      if (!email) {
        throw new Error('Username not found');
      }
      return signInWithEmailAndPassword(this.auth, email, password).then(async userCredential => {
        this.userSubject.next(userCredential.user);

        const snapshot = await getDoc(doc(this.firestore, 'users', userCredential.user.uid));
        const data = snapshot.data();
        const roles = Array.isArray(data?.['roles']) ? data['roles'] : [];
        this.rolesSubject.next(roles);

        return userCredential.user;
      });
    });
  }

  private async getUserEmailByUsername(username: string): Promise<string | null> {
    const usersRef = doc(this.firestore, 'usernames', username);
    const snapshot = await getDoc(usersRef);
    return snapshot.exists() ? snapshot.data()['email'] : null;
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