import { inject, Injectable } from '@angular/core';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User } from '@angular/fire/auth';
import {from, Observable} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoginService {

  auth = inject(Auth);

  log(email: string, password: string): Observable<User>{
    //signInwithEmailAndPassword() returns a Promise and to convert it a Observable we use the from() operator
    return from(signInWithEmailAndPassword(this.auth, email, password).then(res=> res.user));
  }

  register(email: string, password: string): Observable<User>{
    return from(createUserWithEmailAndPassword(this.auth, email, password).then(res => res.user));
  }

  logout():Observable<void>{
    return from(signOut(this.auth));
  }

  currentUser(): User | null{
    return this.auth.currentUser;
  }
}
