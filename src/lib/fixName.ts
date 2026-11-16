// Pure helpers for the /fix-a-name/ form. Payload shape follows the hutch-forms contract (v1).

export const REQUEST_TYPES = ['nickname', 'spelling', 'removal', 'other'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const TYPE_LABELS: Record<RequestType, string> = {
  nickname: 'Nickname',
  spelling: 'Spelling fix',
  removal: 'Remove info',
  other: 'Other',
};

export const RELATIONSHIPS = ['player', 'parent', 'family', 'coach', 'fan', 'other'] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];
export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  player: 'Player', parent: 'Parent', family: 'Family', coach: 'Coach', fan: 'Fan', other: 'Other',
};

/** Label for the "suggested" input, or null when the field is hidden (removal). */
export function suggestedLabel(type: RequestType): string | null {
  if (type === 'nickname') return 'Nickname';
  if (type === 'spelling') return 'Correct spelling';
  if (type === 'other') return 'Suggested change';
  return null;
}
/** The contract requires `suggested` for every type except removal. */
export const suggestedRequired = (type: RequestType) => type !== 'removal';

export interface FormValues {
  type: string;
  playerSlug?: string;
  playerName?: string;
  suggested?: string;
  submitterName: string;
  relationship: string;
  contact?: string;
  message?: string;
  website?: string;
  startedAt: number | string;
}

export interface Payload {
  site: 'hutch';
  type: string;
  playerSlug?: string;
  playerName?: string;
  suggested?: string;
  submitterName: string;
  relationship: string;
  contact?: string;
  message?: string;
  website: string;
  startedAt: number;
}

/** JSON body for POST /api/submissions. Empty optionals are omitted; removal never sends `suggested`. */
export function buildPayload(v: FormValues): Payload {
  const t = (s: string | undefined) => (s ?? '').trim();
  const out: Payload = {
    site: 'hutch',
    type: v.type,
    submitterName: t(v.submitterName),
    relationship: v.relationship,
    website: v.website ?? '',
    startedAt: Number(v.startedAt) || 0,
  };
  const slug = t(v.playerSlug);
  if (slug) {
    out.playerSlug = slug;
    if (t(v.playerName)) out.playerName = t(v.playerName);
  }
  if (v.type !== 'removal' && t(v.suggested)) out.suggested = t(v.suggested);
  if (t(v.contact)) out.contact = t(v.contact);
  if (t(v.message)) out.message = t(v.message);
  return out;
}

/** `?player=<slug>` value if it names a player in the list, else ''. */
export function preselectSlug(param: string | null | undefined, slugs: string[]): string {
  return param && slugs.includes(param) ? param : '';
}

export const FIELD_LABELS: Record<string, string> = {
  type: 'What do you need?',
  playerSlug: 'Player',
  playerName: 'Player',
  suggested: 'Suggested name',
  submitterName: 'Your name',
  relationship: 'Your relationship',
  contact: 'Contact',
  message: 'Message',
  startedAt: 'Form',
};

export const RATE_LIMIT_MESSAGE = 'You have sent a few requests already. Please wait about 10 minutes and try again.';
export const GENERIC_ERROR = 'Something went wrong sending that. Please try again later.';
export const NETWORK_ERROR = 'We could not reach the server. Check your connection and try again later.';

/** Message for an `?error=<code>` redirect from the no-JS path (also used for JSON error codes). */
export function errorMessage(code: string): string {
  if (code === 'rate_limited') return RATE_LIMIT_MESSAGE;
  if (code === 'invalid') return 'Please check the form and try again.';
  if (code === 'too_large') return 'That message is too long. Please shorten it and try again.';
  return GENERIC_ERROR;
}
