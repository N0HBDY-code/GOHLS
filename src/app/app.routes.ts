import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { RegisterComponent } from './register/register.component';
import { VerifyEmailComponent } from './verify-email/verify-email.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';

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
    }

];
