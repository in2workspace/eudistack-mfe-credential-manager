import { IssuanceChannelResponse } from '../dto/lear-credential-issuance-request.dto';
import { resolveChannelOutcomes } from './issuance-channel-outcome';

describe('resolveChannelOutcomes', () => {

  function response(overrides: Partial<IssuanceChannelResponse>): IssuanceChannelResponse {
    return { channel: 'direct', status: 200, ...overrides };
  }

  it('resolves a direct-only delivery as delivered', () => {
    const outcomes = resolveChannelOutcomes(
      [response({ channel: 'direct', status: 200, body: { signed_credential: 'jwt' } })],
      ['direct']
    );

    expect(outcomes.get('direct')).toBe('delivered');
  });

  it('resolves a hybrid direct + ui as both delivered', () => {
    const outcomes = resolveChannelOutcomes(
      [
        response({ channel: 'direct', status: 200, body: { signed_credential: 'jwt' } }),
        response({ channel: 'ui', status: 200, body: { credential_offer_uri: 'openid-credential-offer://...' } }),
      ],
      ['direct', 'ui']
    );

    expect(outcomes.get('direct')).toBe('delivered');
    expect(outcomes.get('ui')).toBe('delivered');
  });

  it('resolves a hybrid direct + email as both delivered', () => {
    const outcomes = resolveChannelOutcomes(
      [
        response({ channel: 'direct', status: 200, body: { signed_credential: 'jwt' } }),
        response({ channel: 'email', status: 200 }),
      ],
      ['direct', 'email']
    );

    expect(outcomes.get('direct')).toBe('delivered');
    expect(outcomes.get('email')).toBe('delivered');
  });

  it('resolves all three modes as delivered when all three succeed', () => {
    const outcomes = resolveChannelOutcomes(
      [
        response({ channel: 'direct', status: 200, body: { signed_credential: 'jwt' } }),
        response({ channel: 'ui', status: 200, body: { credential_offer_uri: 'openid-credential-offer://...' } }),
        response({ channel: 'email', status: 200 }),
      ],
      ['direct', 'ui', 'email']
    );

    expect(outcomes.get('direct')).toBe('delivered');
    expect(outcomes.get('ui')).toBe('delivered');
    expect(outcomes.get('email')).toBe('delivered');
  });

  it('resolves direct delivered + wallet failed independently, without hiding direct', () => {
    const outcomes = resolveChannelOutcomes(
      [
        response({ channel: 'direct', status: 200, body: { signed_credential: 'jwt' } }),
        response({ channel: 'ui', status: 504, error: { type: 'about:blank', title: 'Gateway Timeout', status: 504, detail: 'wallet timeout' } }),
      ],
      ['direct', 'ui']
    );

    expect(outcomes.get('direct')).toBe('delivered');
    expect(outcomes.get('ui')).toBe('failed');
  });

  it('resolves direct failed + wallet delivered independently', () => {
    const outcomes = resolveChannelOutcomes(
      [
        response({ channel: 'direct', status: 503, error: { type: 'about:blank', title: 'Service Unavailable', status: 503, detail: 'signer down' } }),
        response({ channel: 'ui', status: 200, body: { credential_offer_uri: 'openid-credential-offer://...' } }),
      ],
      ['direct', 'ui']
    );

    expect(outcomes.get('direct')).toBe('failed');
    expect(outcomes.get('ui')).toBe('delivered');
  });

  it('resolves a 2xx direct item without signed_credential as missing, not delivered or failed (ES-02)', () => {
    const outcomes = resolveChannelOutcomes(
      [response({ channel: 'direct', status: 200, body: {} })],
      ['direct']
    );

    expect(outcomes.get('direct')).toBe('missing');
  });

  it('resolves a requested mode with no matching item at all as missing', () => {
    const outcomes = resolveChannelOutcomes(
      [response({ channel: 'direct', status: 200, body: { signed_credential: 'jwt' } })],
      ['direct', 'email']
    );

    expect(outcomes.get('email')).toBe('missing');
  });

  it('resolves each item from a 207 independently of the others, regardless of array order (EC-03, EC-07)', () => {
    const outcomes = resolveChannelOutcomes(
      [
        response({ channel: 'email', status: 503, error: { type: 'about:blank', title: 'Service Unavailable', status: 503, detail: 'smtp down' } }),
        response({ channel: 'ui', status: 200, body: { credential_offer_uri: 'openid-credential-offer://...' } }),
        response({ channel: 'direct', status: 200, body: { signed_credential: 'jwt' } }),
      ],
      ['direct', 'ui', 'email']
    );

    expect(outcomes.get('direct')).toBe('delivered');
    expect(outcomes.get('ui')).toBe('delivered');
    expect(outcomes.get('email')).toBe('failed');
  });
});
