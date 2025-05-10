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

  email = '';
  password = '';
  errorMessage = '';

  login() {
    if (this.email === '') {
      alert('Please enter your email');
      return;
    }

    if (this.password === '') {
      alert('Please enter your password');
      return;
    }

    this.authService.login(this.email, this.password)
      .then(() => {
        // Success: redirect to dashboard
        this.router.navigate(['/dashboard']);
        this.email = '';
        this.password = '';
      })
      .catch(err => {
        // Error: show message
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