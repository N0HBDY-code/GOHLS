import { inject, Injectable } from '@angular/core';
import { setThrowInvalidWriteToSignalError } from '@angular/core/primitives/signals';
import { Auth, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private auth = inject(Auth);
  private router = inject(Router);

  login(email: string, password: string) {
    signInWithEmailAndPassword(this.auth, email, password).then(() => {
      localStorage.setItem('token', 'true');
      this.router.navigate(['/dashboard'])
    }, err => {
      alert('Something went wrong');
      this.router.navigate(['/login'])
    })
  }

  register(email: string, password: string) {
    createUserWithEmailAndPassword(this.auth, email, password).then(() => {
      alert('Registration Successful')
      this.router.navigate(['/login'])
    }, err => {
      alert(err.message)
      this.router.navigate(['/register'])
    })
  }

  logout(){
    signOut(this.auth).then(() => {
      localStorage.removeItem('token');
      this.router.navigate(['/login'])
    }, err => {
      alert(err.message);
      })
  }

  forgotPassword(email: string) {
    sendPasswordResetEmail(this.auth, email).then(() => {
      this.router.navigate(['/verify-email']);
    }, err => {
      alert('Something went wrong');
    })
  }


}
