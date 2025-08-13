import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './navbar/navbar.component';
import { Router, NavigationEnd } from '@angular/router';
import { filter, take } from 'rxjs/operators';
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
    this.initializeApp();
    
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const noNavbarRoutes = ['/login', '/register', '/forgot-password'];
      this.showNavbar = !noNavbarRoutes.includes(event.urlAfterRedirects);
    });
  }

  private async initializeApp() {
    console.log('App: Initializing application...');
    
    // Wait for auth to initialize
    await this.authService.waitForAuthInit();
    
    console.log('App: Auth initialization complete');
    
    // Check if user is authenticated and handle initial navigation
    this.authService.currentUser.pipe(take(1)).subscribe(user => {
      const currentUrl = this.router.url;
      const publicRoutes = ['/login', '/register', '/forgot-password', '/verify-email'];
      
      if (user && publicRoutes.includes(currentUrl)) {
        // User is logged in but on a public route, redirect to dashboard
        console.log('App: Authenticated user on public route, redirecting to dashboard');
        this.router.navigate(['/dashboard']);
      } else if (!user && !publicRoutes.includes(currentUrl)) {
        // User is not logged in and trying to access protected route
        console.log('App: Unauthenticated user on protected route, redirecting to login');
        this.router.navigate(['/login']);
      }
    });
  }
}
