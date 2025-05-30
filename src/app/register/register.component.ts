import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, UserInfo } from '../auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  user: UserInfo = {
    username: '',
    email: '',
    password: ''
  };

  private authService = inject(AuthService);
  private router = inject(Router);

  register() {
    if (this.user.username === '') {
      alert('Please enter a username');
      return;
    }

    if (this.user.email === '') {
      alert('Please enter email');
      return;
    }

    if (this.user.password === '') {
      alert('Please enter your password');
      return;
    }

    this.authService.register(this.user)
      .then(() => {
        this.router.navigate(['/dashboard']);
        this.user = {
          username: '',
          email: '',
          password: ''
        };
      })
      .catch(err => {
        console.error('Registration failed:', err);
        alert('Registration failed: ' + err.message);
      });
  }
}