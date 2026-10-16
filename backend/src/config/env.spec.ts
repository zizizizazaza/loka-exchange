import { validateEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  PRIVY_APP_ID: 'app-id',
  PRIVY_APP_SECRET: 'app-secret',
};

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CORS_ORIGINS).toEqual([]);
  });

  it('rejects a missing database URL', () => {
    expect(() => validateEnv({ ...base, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it('rejects missing Privy credentials', () => {
    expect(() => validateEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(/PRIVY_APP_ID.*PRIVY_APP_SECRET/);
  });

  it('coerces PORT and splits CORS origins', () => {
    const env = validateEnv({ ...base, PORT: '8080', CORS_ORIGINS: 'http://a.test, http://b.test,' });
    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });
});
