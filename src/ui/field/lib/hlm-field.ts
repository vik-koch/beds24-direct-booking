import { Directive, input } from '@angular/core';
import { BrnField } from '@spartan-ng/brain/field';
import { classes, hlm } from '@spartan-ng/helm/utils';

// spartan/ui's variants without class-variance-authority, which the site does not depend on.
const orientations = {
	vertical: 'spartan-field-orientation-vertical flex-col *:w-full [&>.sr-only]:w-auto',
	horizontal: [
		'spartan-field-orientation-horizontal flex-row items-center',
		'*:data-[slot=field-label]:flex-auto',
		'has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
	],
	responsive: [
		'spartan-field-orientation-responsive flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto [&>.sr-only]:w-auto',
		'@md/field-group:*:data-[slot=field-label]:flex-auto',
		'@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
	],
};

export type FieldVariants = { orientation?: keyof typeof orientations | null };

const fieldVariants = ({ orientation }: FieldVariants) =>
	hlm('spartan-field group/field flex w-full', orientations[orientation ?? 'vertical']);

@Directive({
	selector: '[hlmField],hlm-field',
	exportAs: 'hlmField',
	hostDirectives: [{ directive: BrnField, inputs: ['data-invalid', 'forceInvalid'] }],
	host: {
		role: 'group',
		'data-slot': 'field',
		'[attr.data-orientation]': 'orientation()',
	},
})
export class HlmField {
	public readonly orientation = input<FieldVariants['orientation']>('vertical');

	constructor() {
		classes(() => fieldVariants({ orientation: this.orientation() }));
	}
}
