import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './navbar/navbar.component';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  showNavbar = true;
  private router = inject(Router);
  private authService = inject(AuthService);
  title = 'GOHLS';
  
  constructor() {
    // Wait for auth to initialize before allowing navigation
    this.authService.waitForAuthInit();
    
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const noNavbarRoutes = ['/login', '/register', '/forgot-password'];
      this.showNavbar = !noNavbarRoutes.includes(event.urlAfterRedirects);
    });
  }
}
