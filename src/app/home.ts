import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { Apartment } from '../beds24/client';

@Component({
  selector: 'app-home',
  template: `
    @if (apartments?.length) {
      <ul>
        @for (apartment of apartments; track apartment.id) {
          <li>{{ apartment.name }}</li>
        }
      </ul>
    }
  `,
})
export class Home {
  protected readonly apartments: Apartment[] | null =
    inject(ActivatedRoute).snapshot.data['apartments'];
}
