/** Campaign target-audience options. Keep TARGET_AGE_RANGES in step with the backend enum. */

export const TARGET_AGE_RANGES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;
export type TargetAgeRange = (typeof TARGET_AGE_RANGES)[number];

export const TARGET_GENDERS = [
    { value: 'all', label: 'All' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
] as const;
export type TargetGender = (typeof TARGET_GENDERS)[number]['value'];

export const TARGET_LANGUAGES = [
    'English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali',
    'Gujarati', 'Punjabi', 'Odia', 'Assamese', 'Urdu', 'Konkani', 'Bhojpuri',
];
