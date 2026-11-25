import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, PLATFORM_ID } from '@angular/core';
import { BrnAccordionContent } from '@spartan-ng/brain/accordion';
import { classes } from '@spartan-ng/helm/utils';

@Component({
	selector: 'hlm-accordion-content',
	exportAs: 'hlmAccordionContent',
	changeDetection: ChangeDetectionStrategy.OnPush,
	hostDirectives: [{ directive: BrnAccordionContent, inputs: ['style'] }],
	host: {
		'data-slot': 'accordion-content',
		// Without scripts every panel stands open (ui.css), its links too: inert waits for the browser.
		'[attr.inert]': '_inert()',
	},
	template: `
		<div
			class="spartan-accordion-content-inner [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4"
		>
			<ng-content />
		</div>
	`,
})
export class HlmAccordionContent {
	private readonly _content = inject(BrnAccordionContent);
	private readonly _browser = isPlatformBrowser(inject(PLATFORM_ID));
	protected readonly _inert = computed(() => (this._browser && this._content.state() === 'closed') || null);

	constructor() {
		classes(
			() =>
				'spartan-accordion-content transition-all data-[state=closed]:h-0 data-[state=open]:h-(--brn-accordion-content-height)',
		);
	}
}
