import { describe, expect, it } from 'vitest';
import { shortName } from '../src/lib/format.ts';

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
