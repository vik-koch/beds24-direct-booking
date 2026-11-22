import { Directive, effect, ElementRef, inject, input } from '@angular/core';

const names = ['media', 'sizes', 'srcset', 'src'] as const;

// A picture's files, written only when they differ: hydration writes every attribute Angular knows
// again, and a written src (in Chromium also media, srcset or sizes) loads the picture again. In
// this order, so that a new picture fetches only the file it chooses.
@Directive({ selector: 'img[appFiles], source[appFiles]' })
export class Files {
  readonly appFiles = input.required<Partial<Record<(typeof names)[number], string>>>();

  constructor() {
    const element: Element = inject(ElementRef).nativeElement;
    effect(() => {
      const files = this.appFiles();
      for (const name of names)
        if (files[name] !== undefined && element.getAttribute(name) !== files[name])
          element.setAttribute(name, files[name]);
    });
  }
}
