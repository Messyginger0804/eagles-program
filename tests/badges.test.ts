import { describe, expect, it } from 'vitest';
import { gameBadges, roundName } from '../src/lib/format.ts';

const base = { playoff: false, round: null, districtGame: false, labels: [] as Parameters<typeof gameBadges>[0]['labels'] & {} };
const labels = (g: Parameters<typeof gameBadges>[0]) => gameBadges(g).map((b) => b.label);

describe('gameBadges', () => {
  it('returns nothing for a plain game', () => expect(gameBadges(base)).toEqual([]));
  it('uses the round name for playoff games', () => {
    expect(labels({ ...base, playoff: true, round: 'Bi-District' })).toEqual(['Bi-District']);
  });
  it('falls back to "Playoff" without a round', () => {
    expect(labels({ ...base, playoff: true })).toEqual(['Playoff']);
    expect(labels({ ...base, playoff: true, round: '  ' })).toEqual(['Playoff']);
  });
  it('ignores a round on a non-playoff game', () => expect(labels({ ...base, round: 'Area' })).toEqual([]));
  it('orders playoff, district, senior night, homecoming', () => {
    expect(labels({ ...base, playoff: true, round: 'Area', districtGame: true, labels: ['homecoming', 'seniorNight'] }))
      .toEqual(['Area', 'District', 'Senior Night', 'Homecoming']);
  });
  it('renders Feeder Night as a special badge after the other labels', () => {
    expect(gameBadges({ ...base, labels: ['feederNight'] })[0]).toMatchObject({ key: 'feederNight', label: 'Feeder Night', kind: 'special' });
    expect(labels({ ...base, labels: ['feederNight', 'homecoming', 'seniorNight'] })).toEqual(['Senior Night', 'Homecoming', 'Feeder Night']);
  });
  it('tags kinds and tolerates missing labels', () => {
    expect(gameBadges({ playoff: false, round: null, districtGame: true }).map((b) => b.kind)).toEqual(['district']);
    expect(gameBadges({ ...base, labels: ['seniorNight'] })[0]).toMatchObject({ key: 'seniorNight', kind: 'special' });
  });
});

describe('roundName', () => {
  it('is null off the playoffs, stored name or "Playoffs" on', () => {
    expect(roundName(base)).toBeNull();
    expect(roundName({ playoff: true, round: 'Area Round' })).toBe('Area Round');
    expect(roundName({ playoff: true, round: null })).toBe('Playoffs');
  });
});

import { mapsUrl, siteLabel } from '../src/lib/format.ts';
describe('venue helpers', () => {
  const venue = { name: 'City Bank Stadium', address: '123 Main St, Forney, TX 75126' };
  it('siteLabel prefers the venue name', () => {
    expect(siteLabel({ location: 'neutral', venue })).toBe('City Bank Stadium');
    expect(siteLabel({ location: 'neutral', venue: null })).toBe('Neutral site');
    expect(siteLabel({ location: null })).toBe('Site TBA');
  });
  it('mapsUrl encodes "name, address"', () => {
    expect(mapsUrl(venue)).toBe('https://www.google.com/maps/search/?api=1&query=City%20Bank%20Stadium%2C%20123%20Main%20St%2C%20Forney%2C%20TX%2075126');
  });
});
