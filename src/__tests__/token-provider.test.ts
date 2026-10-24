import { TokenProvider } from '../token-provider';
import { STSArtifacts } from '../types';

function token(id: string, ttl = 10 * 60 * 1000): STSArtifacts {
  return {
    binarySecretB64: 'c2VjcmV0',
    tokenXML: '<t/>',
    assertionID: id,
    expiresAt: Date.now() + ttl,
  };
}

describe('TokenProvider', () => {
  it('reuses a cached token until shortly before it expires', async () => {
    const fetchToken = jest
      .fn()
      .mockResolvedValueOnce(token('a'))
      .mockResolvedValueOnce(token('b'));
    const provider = new TokenProvider(fetchToken, { enabled: true, refreshMargin: 60000 });

    expect(await provider.get()).toMatchObject({
      artifacts: { assertionID: 'a' },
      fromCache: false,
    });
    expect(await provider.get()).toMatchObject({
      artifacts: { assertionID: 'a' },
      fromCache: true,
    });
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });

  it('renews a token inside the refresh margin', async () => {
    const fetchToken = jest
      .fn()
      .mockResolvedValueOnce(token('a', 30000))
      .mockResolvedValueOnce(token('b'));
    const provider = new TokenProvider(fetchToken, { enabled: true, refreshMargin: 60000 });

    await provider.get();
    expect((await provider.get()).artifacts.assertionID).toBe('b');
  });

  it('shares one STS request between concurrent callers', async () => {
    let resolve!: (value: STSArtifacts) => void;
    const fetchToken = jest.fn(() => new Promise<STSArtifacts>((r) => (resolve = r)));
    const provider = new TokenProvider(fetchToken, { enabled: true, refreshMargin: 0 });

    const pending = Promise.all([provider.get(), provider.get(), provider.get()]);
    resolve(token('a'));
    const results = await pending;

    expect(fetchToken).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.artifacts.assertionID)).toEqual(['a', 'a', 'a']);
  });

  it('lets the next caller retry after a failed STS request', async () => {
    const fetchToken = jest
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(token('a'));
    const provider = new TokenProvider(fetchToken, { enabled: true, refreshMargin: 0 });

    await expect(provider.get()).rejects.toThrow('down');
    expect((await provider.get()).artifacts.assertionID).toBe('a');
  });

  it('only drops the token it was asked to invalidate', async () => {
    const fetchToken = jest
      .fn()
      .mockResolvedValueOnce(token('a'))
      .mockResolvedValueOnce(token('b'));
    const provider = new TokenProvider(fetchToken, { enabled: true, refreshMargin: 0 });

    const { artifacts } = await provider.get();
    provider.invalidate(token('other'));
    expect((await provider.get()).fromCache).toBe(true);

    provider.invalidate(artifacts);
    expect((await provider.get()).artifacts.assertionID).toBe('b');
  });

  it('fetches a new token on every call when caching is disabled', async () => {
    const fetchToken = jest.fn().mockResolvedValue(token('a'));
    const provider = new TokenProvider(fetchToken, { enabled: false, refreshMargin: 0 });

    await provider.get();
    await provider.get();
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });
});
