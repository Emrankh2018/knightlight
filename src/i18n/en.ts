// All user-facing strings. Add a sibling file (e.g. ar.ts) with the same shape to translate.
// `dir` is applied to <html> so an RTL locale only needs dir: 'rtl'.

export const en = {
  dir: 'ltr' as 'ltr' | 'rtl',
  lang: 'en',
  app: {
    name: 'Knightlight',
    tagline: 'Learn chess by playing the moves.',
    skipToContent: 'Skip to content',
    footerCredit: 'Puzzles and opening names from the Lichess open database (CC0).',
    footerLicense: 'Code under MIT license.',
  },
  nav: {
    home: 'Home',
    library: 'Courses',
    puzzles: 'Puzzles',
    teacher: 'Teacher',
    explorer: 'Openings',
    play: 'Play',
    review: 'Review',
    profiles: 'Students',
    search: 'Search',
    toggleTheme: 'Switch light/dark theme',
    mainNav: 'Main navigation',
  },
  home: {
    welcome: 'Welcome back, {name}!',
    continue: 'Continue where you left off',
    nothingYet: 'Pick a course to start your first lesson.',
    dueReviews: '{count} reviews due today',
    startCourse: 'Browse courses',
  },
  common: {
    loading: 'Loading…',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    retry: 'Try again',
    notFound: 'Page not found.',
    error: 'Something went wrong.',
  },
} as const;

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };
export type Messages = Widen<typeof en>;
