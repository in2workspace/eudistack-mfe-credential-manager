import { IssuanceChannelResponse } from '../dto/lear-credential-issuance-request.dto';
import { resolveChannelOutcomes } from './issuance-channel-outcome';

describe('resolveChannelOutcomes', () => {

  function response(overrides: Partial<IssuanceChannelResponse>): IssuanceChannelResponse {
    return { channel: 'direct', status: 200, ...overrides };
  }

  it('resolves a direct delivery with a signed credential as delivered', () => {
    const outcomes = resolveChannelOutcomes(
      [response({ channel: 'direct', status: 200, body: { signed_credential: 'jwt' } })],
      ['direct']
    );

    expect(outcomes.get('direct')).toBe('delivered');
  });

  it('resolves a ui delivery as delivered', () => {
    const outcomes = resolveChannelOutcomes(
      [response({ channel: 'ui', status: 200, body: { credential_offer_uri: 'openid-credential-offer://...' } })],
      ['ui']
    );

    expect(outcomes.get('ui')).toBe('delivered');
  });

  it('resolves an email delivery as delivered, with no body', () => {
    const outcomes = resolveChannelOutcomes([response({ channel: 'email', status: 200 })], ['email']);

    expect(outcomes.get('email')).toBe('delivered');
  });

  it('has exactly one entry: the requested mode (EUD-268)', () => {
    const outcomes = resolveChannelOutcomes([response({ channel: 'email', status: 200 })], ['email']);

    expect([...outcomes.keys()]).toEqual(['email']);
  });

  it('resolves a 2xx direct item without signed_credential as missing, not delivered or failed (ES-02)', () => {
    const outcomes = resolveChannelOutcomes(
      [response({ channel: 'direct', status: 200, body: {} })],
      ['direct']
    );

    expect(outcomes.get('direct')).toBe('missing');
  });

  it('resolves the requested mode as missing when responses[] has no item for it', () => {
    const outcomes = resolveChannelOutcomes([], ['email']);

    expect(outcomes.get('email')).toBe('missing');
  });

  it('resolves a non-2xx item as failed (defensive: the Issuer answers a failed delivery as an error)', () => {
    const outcomes = resolveChannelOutcomes([response({ channel: 'ui', status: 503 })], ['ui']);

    expect(outcomes.get('ui')).toBe('failed');
  });
});
