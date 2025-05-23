import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  isDeveloper = false;
  viewAsRoles: string[] = [];
  allRoles: string[] = [
    'viewer',
    'commissioner',
    'gm',
    'stats monkey',
    'finance officer',
    'progression tracker',
  ];

  private rolesSub!: Subscription;
  private viewAsSub!: Subscription;
  allowedRolesForProgression = ['developer', 'commissioner', 'progression tracker'];
  canSeeProgression = false;
  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.rolesSub = this.authService.currentRoles.subscribe(roles => {
      this.isDeveloper = roles.includes('developer'); // only real role
    });
  
    this.viewAsSub = this.authService.effectiveRoles.subscribe(roles => {
      this.viewAsRoles = roles;
      this.canSeeProgression = roles.some(role => this.allowedRolesForProgression.includes(role));
    });
  }
  

  onRoleChange(event: Event): void {
    const selected = (event.target as HTMLSelectElement).value;
    this.authService.setViewAsRole(selected === 'real' ? null : selected);
  }

  logout(): void {
    this.authService.logout().then(() => {
      this.router.navigate(['/login']);
    });
  }

  ngOnDestroy(): void {
    this.rolesSub?.unsubscribe();
    this.viewAsSub?.unsubscribe();
  }
}
