import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test parseKeywords as a pure function — no DB mocking needed
// Import after implementation is created
import { parseKeywords } from '../src/modules/deck/keyword-tag.service';

describe('parseKeywords()', () => {
  it('parses uppercase ACCELERATE keyword from description', () => {
    const keywords = parseKeywords('This unit has ACCELERATE and deals damage.');
    expect(keywords).toContain('accelerate');
  });

  it('parses all uppercase ability keywords', () => {
    const cases: Array<[string, string]> = [
      ['Unit has ASSAULT.', 'assault'],
      ['MULTIATTACK: attacks twice.', 'multiattack'],
      ['This unit has BARRIER.', 'barrier'],
      ['VIGILANCE: may defend.', 'vigilance'],
      ['DRAIN: restore health.', 'drain'],
      ['OVERWHELM: excess damage.', 'overwhelm'],
    ];
    for (const [description, expected] of cases) {
      const keywords = parseKeywords(description);
      expect(keywords).toContain(expected);
    }
  });

  it('parses discard and draw action keywords from description text', () => {
    const keywords = parseKeywords('Discard a card and draw 2 cards from your deck.');
    expect(keywords).toContain('discard');
    expect(keywords).toContain('draw');
  });

  it('parses heal keyword when description contains "heal"', () => {
    const keywords = parseKeywords('This ability will heal your champion for 3.');
    expect(keywords).toContain('heal');
  });

  it('parses heal keyword when description contains "restore"', () => {
    const keywords = parseKeywords('Restore 2 health to target unit.');
    expect(keywords).toContain('heal');
  });

  it('parses buff keyword from "+X might" or "give a unit"', () => {
    const keywords = parseKeywords('Give a unit +2 might this turn.');
    expect(keywords).toContain('buff');
  });

  it('parses sacrifice keyword from "sacrifice"', () => {
    const keywords = parseKeywords('Sacrifice a unit to summon this card.');
    expect(keywords).toContain('sacrifice');
  });

  it('parses sacrifice keyword from "destroy"', () => {
    const keywords = parseKeywords('Destroy target unit with 3 or less might.');
    expect(keywords).toContain('sacrifice');
  });

  it('handles null description gracefully — returns empty array', () => {
    const keywords = parseKeywords(null);
    expect(keywords).toEqual([]);
  });

  it('returns empty array for description with no matching keywords', () => {
    const keywords = parseKeywords('This is a plain unit that attacks.');
    expect(keywords).toEqual([]);
  });

  it('deduplicates keywords (heal appears only once for "heal" and "restore")', () => {
    const keywords = parseKeywords('Heal your champion and restore health.');
    const healCount = keywords.filter((k) => k === 'heal').length;
    expect(healCount).toBe(1);
  });

  it('returns multiple different keywords for a complex description', () => {
    const keywords = parseKeywords('ACCELERATE. Draw 2 cards. Heal target unit. Discard a card.');
    expect(keywords).toContain('accelerate');
    expect(keywords).toContain('draw');
    expect(keywords).toContain('heal');
    expect(keywords).toContain('discard');
    expect(keywords.length).toBeGreaterThanOrEqual(4);
  });
});
