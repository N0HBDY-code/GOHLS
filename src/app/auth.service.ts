import { Injectable } from '@angular/core';
import { Auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { sendPasswordResetEmail } from 'firebase/auth';

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

  constructor(private auth: Auth) {
    // Automatically update currentUser when auth state changes (even on refresh)
    onAuthStateChanged(this.auth, (user) => {
      this.userSubject.next(user);
    });
  }

  register(userInfo: { fname: string; lname: string; email: string; password: string }) {
    return createUserWithEmailAndPassword(this.auth, userInfo.email, userInfo.password).then((userCredential) => {
      // Optionally update display name with full name
      return updateProfile(userCredential.user, {
        displayName: `${userInfo.fname} ${userInfo.lname}`
      }).then(() => {
        this.userSubject.next(userCredential.user);
        return userCredential.user;
      });
    });
  }
  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password).then(userCredential => {
      this.userSubject.next(userCredential.user);
      return userCredential.user;
    });
  }

  forgotPassword(email: string) {
    return sendPasswordResetEmail(this.auth, email);
  }
  
  logout() {
    this.userSubject.next(null);
    return signOut(this.auth);
  }
  signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this.auth, provider).then((result) => {
      this.userSubject.next(result.user);
      return result.user;
    });
  }
}