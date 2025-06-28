import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  username = '';
  password = '';
  errorMessage = '';

  login() {
    if (this.username === '') {
      alert('Please enter your username');
      return;
    }

    if (this.password === '') {
      alert('Please enter your password');
      return;
    }

    this.authService.login(this.username, this.password)
      .then(() => {
        this.router.navigate(['/dashboard']);
        this.username = '';
        this.password = '';
      })
      .catch(err => {
        console.error('Login failed:', err);
        alert('Login failed: ' + err.message);
      });
  }

  signInWithGoogle() {
    this.authService.signInWithGoogle()
      .then(() => this.router.navigate(['/dashboard']))
      .catch(err => alert('Google Sign-in failed: ' + err.message));
  }
}