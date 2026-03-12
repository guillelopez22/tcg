import { describe, it, expect } from 'vitest';
import { autoDetectAndParse } from '@la-grieta/shared';

describe('autoDetectAndParse', () => {
  it("parses '3x Card Name' lines into entries with correct quantities and names", () => {
    const text = '3x Card Name\n2x Other Card';
    const result = autoDetectAndParse(text);
    expect(result.entries).toHaveLength(2);
    const entry = result.entries.find((e) => e.cardName === 'Card Name');
    expect(entry).toBeDefined();
    expect(entry?.quantity).toBe(3);
    const entry2 = result.entries.find((e) => e.cardName === 'Other Card');
    expect(entry2).toBeDefined();
    expect(entry2?.quantity).toBe(2);
  });

  it('assigns correct zones from zone headers (Champion:, Runes:, Main Deck:)', () => {
    const text = [
      'Champion:',
      '1x Legend Card',
      'Runes:',
      '4x Rune Card',
      'Main Deck:',
      '3x Unit Card',
    ].join('\n');
    const result = autoDetectAndParse(text);
    const champion = result.entries.find((e) => e.cardName === 'Legend Card');
    expect(champion?.zone).toBe('champion');
    const rune = result.entries.find((e) => e.cardName === 'Rune Card');
    expect(rune?.zone).toBe('rune');
    const main = result.entries.find((e) => e.cardName === 'Unit Card');
    expect(main?.zone).toBe('main');
  });

  it("returns format 'unknown' for unrecognizable text and collects lines in unmatched", () => {
    const text = 'this is not a deck list at all\nrandom words here';
    const result = autoDetectAndParse(text);
    expect(result.format).toBe('unknown');
    expect(result.unmatched.length).toBeGreaterThan(0);
  });

  it('returns ParseResult with entries, format, and unmatched fields', () => {
    const text = '2x Some Card';
    const result = autoDetectAndParse(text);
    expect(result).toHaveProperty('entries');
    expect(result).toHaveProperty('format');
    expect(result).toHaveProperty('unmatched');
    expect(Array.isArray(result.entries)).toBe(true);
    expect(Array.isArray(result.unmatched)).toBe(true);
  });
});
