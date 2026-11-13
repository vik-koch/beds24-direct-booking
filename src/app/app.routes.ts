import { Routes } from '@angular/router';
import { apartments } from './apartments';
import { Home } from './home';

export const routes: Routes = [{ path: '', component: Home, resolve: { apartments } }];
