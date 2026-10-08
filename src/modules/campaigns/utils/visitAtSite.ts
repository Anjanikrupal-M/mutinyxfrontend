const VISIT_LOCATIONS_LINE_REGEX = /^Locations:\s*([^\n]+)\n*([\s\S]*)$/;

// "|" is the separator between locations, not "," — location names are frequently full
// addresses ("Suite 5, MG Road") that already contain commas, which would otherwise split
// one location into several on the next hydrate.
const LOCATION_SEPARATOR = ' | ';

// The API only persists a single visitAtSiteDescription text field, so multiple visit
// locations are encoded as a leading "Locations: A | B | C" line — this pair keeps any
// location chip list and the free-text description in sync with that string on every
// save/hydrate round-trip without a backend/schema change. Shared by the campaign builder
// (writes it) and the campaign detail page (reads it back for display).
export function splitVisitAtSiteDescription(value: unknown): { locations: string[]; description: string } {
    const raw = String(value ?? '');
    const match = raw.match(VISIT_LOCATIONS_LINE_REGEX);
    if (!match) return { locations: [], description: raw };
    const locations = match[1].split('|').map((s) => s.trim()).filter(Boolean);
    return { locations, description: match[2] };
}

export function joinVisitAtSiteDescription(locations: string[], description: string): string {
    const cleanLocations = locations.map((l) => l.trim()).filter(Boolean);
    const cleanDescription = description.trim();
    if (cleanLocations.length === 0) return cleanDescription;
    const locationsLine = `Locations: ${cleanLocations.join(LOCATION_SEPARATOR)}`;
    return cleanDescription ? `${locationsLine}\n\n${cleanDescription}` : locationsLine;
}
