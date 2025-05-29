import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { RegisterComponent } from './register/register.component';
import { VerifyEmailComponent } from './verify-email/verify-email.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { Analytics } from '@angular/fire/analytics';
import { GamesComponent } from './games/games.component';
import { AnalyticsComponent } from './analytics/analytics.component';
import { ReportsComponent } from './reports/reports.component';
import { TeamsComponent } from './teams/teams.component';
import { PlayersComponent } from './players/players.component';
import { PlayerManagerComponent } from './player-manager/player-manager.component';
import { RoleGuard } from './role.guard';
import { ProgressionTrackerComponent } from './progression-tracker/progression-tracker.component';
import { GameDetailComponent } from './game-detail/game-detail.component';

export const routes: Routes = [
    {
        path: '',
        redirectTo:'login',
        pathMatch: 'full'
    },
    {
        path: 'login',
        component: LoginComponent,
        title: 'Login'
    },
    {
        path: 'dashboard',
        component: DashboardComponent,
        title: 'Dashboard'
    },
    {
        path: 'register',
        component: RegisterComponent,
        title: 'Register'
    },
    {
        path: 'verify-email',
        component: VerifyEmailComponent
    },
    {
        path: 'forgot-password',
        component: ForgotPasswordComponent
    },
    {
        path:'analytics',
        component: AnalyticsComponent,
        title: 'Analytics'
    },
    {
        path:'games',
        component: GamesComponent,
        title: 'Games'
    },
    {
        path: 'games/:teamId/:gameId',
        component: GameDetailComponent,
        title: 'Game Details'
    },
    {
        path:'reports',
        component: ReportsComponent,
        title: 'Reports'
    },
    {
        path: 'teams',
        loadComponent: () => import('./teams/teams.component').then(m => m.TeamsComponent),
        title: 'Teams'
    },
    {
        path: 'teams/:id',
        loadComponent: () =>
          import('./team-detail/team-detail.component').then(m => m.TeamDetailComponent),
        title: 'Team Details'
    },
    {
        path:'player',
        component: PlayersComponent,
        title:'Player'
    },
    {
        path: 'role-management',
        loadComponent: () => import('./role-management/role-management.component').then(m => m.RoleManagementComponent),
        title: 'Roles',
        canActivate: [RoleGuard(['developer', 'commissioner'])]  
    },
    {
        path: 'progression-tracker',
        loadComponent: () => import('./progression-tracker/progression-tracker.component').then(m => m.ProgressionTrackerComponent),
        title: 'Progression Tracker',
        canActivate: [RoleGuard(['developer', 'commissioner', 'progression tracker'])]
    }
];