import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoginService } from '../login.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  private authService = inject(LoginService);
  private router = inject(Router);

  email = '';
  password = '';
  isLogin = true;
  error = '';

  toggleMode() {
  this.isLogin = !this.isLogin;
  this.error = '';
  }

onSubmit() {
    this.error = '';
    const action = this.isLogin ? this.authService.log(this.email, this.password)
                                : this.authService.register(this.email, this.password);

    action.subscribe({
      next: user => {
        console.log(`${this.isLogin ? 'Logged in' : 'Registered'}:`, user);
        this.router.navigate(['product']); // Redirect to home/dashboard
        
      },
      error: err => {
        this.error = err.message;
        console.error(err);
      }
    });
  }

}
