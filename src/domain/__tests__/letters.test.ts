import { addMonths, deliveryInstant, isDelivered, validateLetterDraft } from '../letters';

const now = new Date('2026-10-27T12:00:00Z');
const body = 'Dear future me, please hydrate.';

describe('addMonths', () => {
  it('clamps to the end of shorter months', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-10-27', 12)).toBe('2027-10-27');
  });
});

describe('delivery', () => {
  it('opens at 09:00 local time on the delivery date', () => {
    expect(deliveryInstant('2027-01-10', 'America/New_York').toISOString()).toBe('2027-01-10T14:00:00.000Z');
  });

  it('is delivered only once deliverAt has passed', () => {
    expect(isDelivered({ deliverAt: '2026-10-27T11:59:59Z' }, now)).toBe(true);
    expect(isDelivered({ deliverAt: '2026-10-27T12:00:00Z' }, now)).toBe(true);
    expect(isDelivered({ deliverAt: '2026-10-27T12:00:01Z' }, now)).toBe(false);
  });
});

describe('validateLetterDraft', () => {
  it('accepts a valid draft', () => {
    expect(validateLetterDraft({ title: '', body, deliverOn: '2027-01-01' }, now, 'UTC')).toEqual({});
  });

  it('requires a delivery date at least a day ahead', () => {
    expect(validateLetterDraft({ title: '', body, deliverOn: null }, now, 'UTC').deliverOn).toBeDefined();
    expect(validateLetterDraft({ title: '', body, deliverOn: '2026-10-27' }, now, 'UTC').deliverOn).toBeDefined();
    expect(validateLetterDraft({ title: '', body, deliverOn: '2026-10-28' }, now, 'UTC').deliverOn).toBeUndefined();
  });

  it('uses the user’s zone to decide what “today” is', () => {
    // 12:00 UTC on 27 Oct is already 28 Oct in Kiritimati (UTC+14), so 28 Oct is too soon there.
    expect(validateLetterDraft({ title: '', body, deliverOn: '2026-10-28' }, now, 'Pacific/Kiritimati').deliverOn).toBeDefined();
  });

  it('caps how far ahead a letter can go', () => {
    expect(validateLetterDraft({ title: '', body, deliverOn: '2052-01-01' }, now, 'UTC').deliverOn).toBeDefined();
  });

  it('rejects bodies that are too short and titles that are too long', () => {
    const errors = validateLetterDraft({ title: 'x'.repeat(81), body: 'hi', deliverOn: '2027-01-01' }, now, 'UTC');
    expect(errors.title).toBeDefined();
    expect(errors.body).toBeDefined();
  });
});
