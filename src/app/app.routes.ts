import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { RegisterComponent } from './register/register.component';
import { VerifyEmailComponent } from './verify-email/verify-email.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { GamesComponent } from './games/games.component';
import { AnalyticsComponent } from './analytics/analytics.component';
import { TeamsComponent } from './teams/teams.component';
import { PlayersComponent } from './players/players.component';
import { PlayerManagerComponent } from './player-manager/player-manager.component';
import { RoleGuard } from './role.guard';
import { ProgressionTrackerComponent } from './progression-tracker/progression-tracker.component';
import { GameDetailComponent } from './game-detail/game-detail.component';
import { HeadquartersComponent } from './headquarters/headquarters.component';
import { DraftComponent } from './draft/draft.component';
import { AuthGuard } from './auth.guard';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'dashboard',
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
        title: 'Dashboard',
        canActivate: [AuthGuard]
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
        title: 'Stats and Standings',
        canActivate: [AuthGuard]
    },
    {
        path:'games',
        component: GamesComponent,
        title: 'Games',
        canActivate: [AuthGuard]
    },
    {
        path: 'games/:teamId/:gameId',
        component: GameDetailComponent,
        title: 'Game Details',
        canActivate: [AuthGuard]
    },
    {
        path: 'teams',
        loadComponent: () => import('./teams/teams.component').then(m => m.TeamsComponent),
        title: 'Teams',
        canActivate: [AuthGuard]
    },
    {
        path: 'teams/:id',
        loadComponent: () =>
          import('./team-detail/team-detail.component').then(m => m.TeamDetailComponent),
        title: 'Team Details',
        canActivate: [AuthGuard]
    },
    {
        path:'player',
        component: PlayersComponent,
        title:'Player',
        canActivate: [AuthGuard]
    },
    {
        path: 'headquarters',
        loadComponent: () => import('./headquarters/headquarters.component').then(m => m.HeadquartersComponent),
        title: 'Headquarters',
        canActivate: [AuthGuard, RoleGuard(['developer', 'commissioner'])]
    },
    {
        path: 'progression-tracker',
        loadComponent: () => import('./progression-tracker/progression-tracker.component').then(m => m.ProgressionTrackerComponent),
        title: 'Progression Tracker',
        canActivate: [AuthGuard, RoleGuard(['developer', 'commissioner', 'progression tracker'])]
    },
    {
        path: 'draft',
        loadComponent: () => import('./draft/draft.component').then(m => m.DraftComponent),
        title: 'Draft Central',
        canActivate: [AuthGuard, RoleGuard(['developer', 'commissioner', 'gm'])]
    }
];