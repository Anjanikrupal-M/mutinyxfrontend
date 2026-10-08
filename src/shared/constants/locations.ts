import { State, City } from 'country-state-city';

const IN_STATES = State.getStatesOfCountry('IN');

export const INDIAN_STATES: string[] = IN_STATES.map((s) => s.name);

export function getIndianCities(stateName: string): string[] {
    const state = IN_STATES.find((s) => s.name === stateName);
    if (!state) return [];
    return City.getCitiesOfState('IN', state.isoCode).map((c) => c.name);
}

// Metros and state capitals, listed first so the common picks need no typing.
const MAJOR_CITIES = [
    'Hyderabad, Telangana', 'Bengaluru, Karnataka', 'Mumbai, Maharashtra', 'New Delhi, Delhi',
    'Chennai, Tamil Nadu', 'Kolkata, West Bengal', 'Pune, Maharashtra', 'Ahmedabad, Gujarat',
    'Visakhapatnam, Andhra Pradesh', 'Vijayawada, Andhra Pradesh', 'Jaipur, Rajasthan',
    'Lucknow, Uttar Pradesh', 'Chandigarh, Chandigarh', 'Thiruvananthapuram, Kerala',
    'Bhopal, Madhya Pradesh', 'Indore, Madhya Pradesh', 'Patna, Bihar', 'Guwahati, Assam',
    'Coimbatore, Tamil Nadu', 'Surat, Gujarat', 'Nagpur, Maharashtra', 'Warangal, Telangana',
    'Gurgaon, Haryana', 'Noida, Uttar Pradesh', 'Ranchi, Jharkhand', 'Raipur, Chhattisgarh',
    'Dehradun, Uttarakhand', 'Panaji, Goa', 'Mysuru, Karnataka', 'Madurai, Tamil Nadu',
];

let cityStateOptions: string[] | null = null;

/**
 * Every Indian city as "City, State" (e.g. "Hyderabad, Telangana") — the form audience
 * insights report cities in. Major cities first, the rest alphabetical. Built once, lazily.
 */
export function getIndianCityStateOptions(): string[] {
    if (cityStateOptions) return cityStateOptions;
    const all = new Set<string>();
    for (const state of IN_STATES) {
        for (const city of City.getCitiesOfState('IN', state.isoCode)) all.add(`${city.name}, ${state.name}`);
    }
    const major = MAJOR_CITIES.filter((c) => all.has(c));
    const majorSet = new Set(major);
    const rest = [...all].filter((c) => !majorSet.has(c)).sort((a, b) => a.localeCompare(b));
    cityStateOptions = [...major, ...rest];
    return cityStateOptions;
}
