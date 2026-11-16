import { describe, expect, it } from 'vitest';
import { buildPayload, preselectSlug, suggestedLabel, suggestedRequired, errorMessage, RATE_LIMIT_MESSAGE } from '../src/lib/fixName.ts';

const base = { submitterName: ' Pat ', relationship: 'parent', website: '', startedAt: '1700000000000' };

describe('buildPayload', () => {
  it('matches the contract shape for a nickname', () => {
    expect(buildPayload({ ...base, type: 'nickname', playerSlug: '15-darrick-todd', playerName: '#15 Darrick “DJ” Todd', suggested: ' DJ ', contact: '', message: '' })).toEqual({
      site: 'hutch', type: 'nickname', playerSlug: '15-darrick-todd', playerName: '#15 Darrick “DJ” Todd', suggested: 'DJ',
      submitterName: 'Pat', relationship: 'parent', website: '', startedAt: 1700000000000,
    });
  });
  it('omits suggested for removal even if one was typed', () => {
    const p = buildPayload({ ...base, type: 'removal', suggested: 'x', message: 'please remove' });
    expect('suggested' in p).toBe(false);
    expect(p.message).toBe('please remove');
  });
  it('omits player fields when no player is chosen', () => {
    const p = buildPayload({ ...base, type: 'other', playerSlug: '', playerName: 'Not listed' });
    expect('playerSlug' in p || 'playerName' in p).toBe(false);
  });
  it('passes the honeypot through and coerces startedAt to a number', () => {
    const p = buildPayload({ ...base, type: 'other', website: 'bot' });
    expect(p.website).toBe('bot');
    expect(typeof p.startedAt).toBe('number');
  });
});

describe('form helpers', () => {
  it('preselects only known slugs', () => {
    expect(preselectSlug('15-darrick-todd', ['15-darrick-todd'])).toBe('15-darrick-todd');
    expect(preselectSlug('nope', ['15-darrick-todd'])).toBe('');
    expect(preselectSlug(null, ['a'])).toBe('');
  });
  it('switches the suggested label by type and hides it for removal', () => {
    expect(suggestedLabel('nickname')).toBe('Nickname');
    expect(suggestedLabel('spelling')).toBe('Correct spelling');
    expect(suggestedLabel('removal')).toBeNull();
    expect(suggestedRequired('removal')).toBe(false);
    expect(suggestedRequired('spelling')).toBe(true);
    expect(suggestedRequired('other')).toBe(true);
  });
  it('maps error codes to messages', () => {
    expect(errorMessage('rate_limited')).toBe(RATE_LIMIT_MESSAGE);
    expect(errorMessage('whatever')).toMatch(/try again later/);
  });
});
