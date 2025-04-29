import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ProductListComponent } from './product-list/product-list.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoginComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'practice-authentication';
  router = inject(Router)

  ngOnInint(){
    this.router.navigateByUrl('auth');
  }
}
