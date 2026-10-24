import { STSArtifacts } from './types';

/**
 * Hands out STS tokens, reusing a cached token until shortly before it expires and
 * sharing a single in-flight STS request between concurrent callers
 * @internal
 */
export class TokenProvider {
  private cached: STSArtifacts | null = null;
  private pending: Promise<STSArtifacts> | null = null;

  constructor(
    private readonly fetchToken: () => Promise<STSArtifacts>,
    private readonly options: { enabled: boolean; refreshMargin: number }
  ) {}

  /**
   * @returns the token and whether it was served from the cache
   */
  async get(): Promise<{ artifacts: STSArtifacts; fromCache: boolean }> {
    if (!this.options.enabled) {
      return { artifacts: await this.fetchToken(), fromCache: false };
    }

    if (this.cached && Date.now() < this.cached.expiresAt - this.options.refreshMargin) {
      return { artifacts: this.cached, fromCache: true };
    }

    if (!this.pending) {
      this.pending = this.fetchToken()
        .then((artifacts) => {
          this.cached = artifacts;
          return artifacts;
        })
        .finally(() => {
          this.pending = null;
        });
    }

    return { artifacts: await this.pending, fromCache: false };
  }

  /**
   * Drop the cached token (only if it is the given one, when provided)
   */
  invalidate(artifacts?: STSArtifacts): void {
    if (!artifacts || this.cached === artifacts) {
      this.cached = null;
    }
  }
}
