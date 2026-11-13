import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', children: [] },
  {
    path: 'spike/stay-picker',
    loadComponent: () => import('./stay-picker/stay-picker-spike').then((m) => m.StayPickerSpike),
  },
];
