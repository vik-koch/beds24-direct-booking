import type { Map } from 'maplibre-gl';

// What the last map left, written only in the browser: the next map the application shows, such
// as the other language's after a change of language, takes over its drawn map and its choices,
// as the visitor left them. A page the browser loads starts afresh. Apart from the map's code, so
// that the home page can show a map at once that has one to take over.
export const handover: {
  drawn?: Map;
  chosen?: string;
  picked?: string;
  all?: boolean;
} = {};
