import { describe, expect, it } from 'vitest';
import { shortName, fullName, kickoffLabel } from '../src/lib/format.ts';

describe('shortName', () => {
  it('first initial and last name', () => expect(shortName('Jaylen', 'Gaston')).toBe('J. Gaston'));
  it('keeps a hyphenated last name', () => expect(shortName('Ana', 'Smith-Jones')).toBe('A. Smith-Jones'));
  it('handles an apostrophe in either name', () => {
    expect(shortName("D'Angelo", 'Reed')).toBe('D. Reed');
    expect(shortName('Cam', "O'Neal")).toBe("C. O'Neal");
  });
  it('keeps a Jr. suffix', () => expect(shortName('Marcus', 'Hall Jr.')).toBe('M. Hall Jr.'));
  it('single word: no first name gives just the last name', () => expect(shortName('', 'Cher')).toBe('Cher'));
});

describe('fullName', () => {
  const todd = { firstName: 'Darrick', lastName: 'Todd', careerId: 'a59f8ctg39ai2' };
  it('puts the nickname in curly quotes', () => expect(fullName(todd)).toBe('Darrick “DJ” Todd'));
  it('is plain First Last without a nickname', () => expect(fullName({ firstName: 'Jaylen', lastName: 'Gaston', careerId: 'x1' })).toBe('Jaylen Gaston'));
  it('ignores an unknown career_id and a missing one', () => {
    expect(fullName({ firstName: 'Ana', lastName: 'Reed', careerId: 'nope' })).toBe('Ana Reed');
    expect(fullName({ firstName: 'Ana', lastName: 'Reed' })).toBe('Ana Reed');
  });
});

describe('kickoffLabel', () => {
  it('formats 24h local time as 12h', () => {
    expect(kickoffLabel('19:00')).toBe('7:00 PM');
    expect(kickoffLabel('19:30')).toBe('7:30 PM');
    expect(kickoffLabel('11:05')).toBe('11:05 AM');
    expect(kickoffLabel('12:00')).toBe('12:00 PM');
    expect(kickoffLabel('00:15')).toBe('12:15 AM');
  });
  it('is TBA when not announced', () => expect(kickoffLabel(null)).toBe('TBA'));
});
