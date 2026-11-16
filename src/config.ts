export const SITE_TITLE = 'WH Eagles Game Day';
/** Path under public/ of the team logo (base is added by <Logo>). null = styled WH monogram. */
export const LOGO_SRC: string | null = '/brand/eagle-240.png';
export const THEME_COLOR = '#050F25';
export const TAGLINE = 'THE HUTCH IS TOO MUCH';
export const INDEXABLE = false;
/** No public contact yet; do not invent one. */
export const REMOVAL_CONTACT: string | null = null;
export const MAXPREPS_TEAM_URL =
  'https://www.maxpreps.com/tx/dallas/wilmer-hutchins-eagles/football/';

/**
 * Welcome note (fan's point of view), shown in the first-visit sheet, /seniors-coaches and /print.
 * Blank line = new paragraph. In the sheet the first paragraph is the heading and the last is the sign-off.
 */
export const WELCOME_NOTE = `Welcome to Eagles Football!

This fan-made program helps everyone in the stands put a name to a number. Thank you to the players, coaches and families who make Friday nights special. Let's go, Eagles! 🦅

— A proud Eagles football parent`;

/** Small ad for the site builder, shown in the welcome sheet and the footer. Set enabled: false to remove both. */
export const PROMO = {
  enabled: true,
  heading: 'Need a website or custom software?',
  linkText: 'DFW Software Consulting',
  bodyAfterLink: ' built this site, and we can build yours too.',
  url: 'https://dfwsc.com/?utm_source=eagles-program&utm_medium=referral&utm_campaign=welcome',
  footerUrl: 'https://dfwsc.com/?utm_source=eagles-program&utm_medium=referral&utm_campaign=footer',
};

/** Jim Mora "Playoffs?!" clip (NFL channel on GIPHY), hotlinked on /schedule when the season has a playoff game. */
export const PLAYOFFS_GIF = {
  page: 'https://giphy.com/gifs/nfl-confused-playoffs-jim-mora-aEG9ByjIfupJXakkac',
  animated: 'https://media.giphy.com/media/aEG9ByjIfupJXakkac/giphy.webp',
  still: 'https://media.giphy.com/media/aEG9ByjIfupJXakkac/giphy_s.gif',
  width: 480,
  height: 480,
};

export interface PlayoffRound {
  name: string;
  /** Game-week window from the UIL calendar. */
  weekLabel: string;
  /** Venue when UIL has announced it, otherwise null (shown as TBA). */
  site: string | null;
}

/**
 * UIL football playoff rounds in order, keyed by season. Update every season (dates move each year).
 * 2026 sources, checked 2026-11-16:
 * - Playoff Dates (Week One Nov 12-14 ... Week Five Dec 10-12, State Championships Dec 16-19): https://www.uiltexas.org/football
 * - 4A Division I bracket (loads from MaxPreps, lists no round names): https://www.uiltexas.org/football/playoff-brackets/4AD1
 * - State Championship site, AT&T Stadium in Arlington: https://www.davecampbells.com/
 * Our DB confirms only "Bi-District" (Nov 12-14) and "Area" (Nov 19-21). UIL's calendar names weeks 3 to 5 only as
 * "Week Three/Four/Five", and no source checked gives round names for them, so they stay generic. Rename them when
 * UIL publishes names. Sites for rounds before the State Championship are not announced (null = TBA).
 */
export const PLAYOFF_ROUNDS: Record<number, PlayoffRound[]> = {
  2026: [
    { name: 'Bi-District', weekLabel: 'Nov 12–14', site: null },
    { name: 'Area', weekLabel: 'Nov 19–21', site: null },
    { name: 'Round 3', weekLabel: 'Nov 26–28', site: null },
    { name: 'Round 4', weekLabel: 'Dec 3–5', site: null },
    { name: 'Round 5', weekLabel: 'Dec 10–12', site: null },
    { name: 'State Championship', weekLabel: 'Dec 16–19', site: 'AT&T Stadium, Arlington' },
  ],
};
