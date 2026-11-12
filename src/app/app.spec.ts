import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  it('renders the heading', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toBe('beds24-direct-booking');
  });
});
