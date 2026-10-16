import { tierFor } from './access-tier.js';

describe('tierFor', () => {
  it('is unverified without an institution or before KYB', () => {
    expect(tierFor([])).toBe('unverified');
    expect(tierFor(['NOT_STARTED'])).toBe('unverified');
    expect(tierFor(['IN_PROGRESS'])).toBe('unverified');
  });

  it('is pending while any case is in review', () => {
    expect(tierFor(['SUBMITTED'])).toBe('pending');
    expect(tierFor(['INFO_REQUESTED'])).toBe('pending');
  });

  it('is verified once any institution is approved', () => {
    expect(tierFor(['REJECTED', 'APPROVED'])).toBe('verified');
  });

  it('treats rejected and suspended as unverified', () => {
    expect(tierFor(['REJECTED'])).toBe('unverified');
    expect(tierFor(['SUSPENDED'])).toBe('unverified');
  });
});
