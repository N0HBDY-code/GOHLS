import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { AppComponent } from './app.component';
import { ProductListComponent } from './product-list/product-list.component';

export const routes: Routes = [
    {
        path: 'auth',
        component: LoginComponent,
        title: "Login"
    },
    {
        path: 'product',
        component: ProductListComponent,
        title: 'Home'
    }
];
