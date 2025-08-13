import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { map, take, switchMap, timer } from 'rxjs/operators';
import { of } from 'rxjs';

export const AuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  return authService.authInitialized$.pipe(
    switchMap(initialized => {
      if (!initialized) {
        // Wait a bit more for auth to initialize
        return timer(1000).pipe(
          switchMap(() => authService.currentUser.pipe(take(1)))
        );
      }
      return authService.currentUser.pipe(take(1));
    }),
    map(user => {
      if (user) {
        return true;
      } else {
        router.navigate(['/login']);
        return false;
      }
    })
  );
};