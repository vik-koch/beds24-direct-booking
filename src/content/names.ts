// Names the schema and the application share. Kept apart from the schema, so that the
// browser's bundle does not take Zod along with them.
export const seasonNames = ['winter', 'summer'] as const;
export type SeasonName = (typeof seasonNames)[number];

export const featureIcons = ['house', 'calendar', 'tag', 'mountain', 'users', 'key'] as const;
export type FeatureIcon = (typeof featureIcons)[number];
