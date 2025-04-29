import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {

  private authService = inject(AuthService);

  email: string = '';

  forgotPassword() {
    this.authService.forgotPassword(this.email);
    this.email = '';
  }
}
