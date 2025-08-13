import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const AuthGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  console.log('AuthGuard: Starting authentication check...');
  
  // Wait for auth to initialize (with timeout)
  const authInitialized = await authService.waitForAuthInit();
  
  if (!authInitialized) {
    console.log('AuthGuard: Auth initialization timeout, redirecting to login');
    router.navigate(['/login']);
    return false;
  }
  
  // Check if user is authenticated
  const user = authService.getCurrentUser();
  
  if (user) {
    console.log('AuthGuard: User authenticated, allowing access');
    return true;
  } else {
    console.log('AuthGuard: No authenticated user, redirecting to login');
    router.navigate(['/login']);
    return false;
  }
};