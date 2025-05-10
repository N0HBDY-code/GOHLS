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
        path:'reports',
        component: ReportsComponent,
        title: 'Reports'
    },
    {
        path:'teams',
        component: TeamsComponent,
        title: 'Teams'
    }

];
