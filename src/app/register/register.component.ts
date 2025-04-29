import { Component, inject } from '@angular/core';
import { AuthService } from '../auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-register',
  imports: [FormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  email = '';
  password = '';

  private authService = inject(AuthService)

  register() {
    if (this.email == '') {
      alert('Please enter email');
      return;
    }

    if (this.password == ''){
      alert('Please enter your password')
      return;
    }

    this.authService.register(this.email, this.password);
    this.email = '';
    this.password = '';

  }
}
