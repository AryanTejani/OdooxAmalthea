import { Issuer, Client, generators } from 'openid-client';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

let googleClient: Client | null = null;

/**
 * Initialize Google OIDC client
 */
export async function getGoogleClient(): Promise<Client> {
  if (googleClient) {
    return googleClient;
  }

  try {
    // Discover Google's OIDC configuration
    const googleIssuer = await Issuer.discover('https://accounts.google.com');

    logger.info('Google OIDC issuer discovered');

    // Create client
    googleClient = new googleIssuer.Client({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uris: [env.GOOGLE_REDIRECT_URI],
      response_types: ['code'],
    });

    return googleClient;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Google OIDC client');
    throw error;
  }
}

/**
 * Generate PKCE code verifier
 */
export function generateCodeVerifier(): string {
  return generators.codeVerifier();
}

/**
 * Generate PKCE code challenge from verifier
 */
export function generateCodeChallenge(verifier: string): string {
  return generators.codeChallenge(verifier);
}

/**
 * Generate state for OAuth flow
 */
export function generateState(): string {
  return generators.state();
}

/**
 * Build authorization URL with PKCE
 */
export async function buildAuthorizationUrl(
  state: string,
  codeChallenge: string
): Promise<string> {
  const client = await getGoogleClient();

  return client.authorizationUrl({
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<{
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}> {
  const client = await getGoogleClient();

  const tokenSet = await client.callback(
    env.GOOGLE_REDIRECT_URI,
    { code },
    { code_verifier: codeVerifier }
  );

  if (!tokenSet.claims()) {
    throw new Error('No claims in token set');
  }

  const claims = tokenSet.claims();

  return {
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    picture: claims.picture,
  };
}

