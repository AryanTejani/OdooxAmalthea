import { Response } from 'express';
import { isProduction } from '../config/env';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProduction(),
  path: '/',
};

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * Set authentication cookies (access + refresh tokens)
 */
export function setAuthCookies(res: Response, tokens: AuthTokens): void {
  // Access token - 15 minutes
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 minutes in ms
  });

  // Refresh token - 7 days
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
}

/**
 * Clear authentication cookies
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
  });

  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
  });
}

/**
 * Set OAuth state cookie (10 minutes, transient)
 */
export function setOAuthStateCookie(res: Response, state: string): void {
  res.cookie('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Set PKCE code verifier cookie (10 minutes, transient)
 */
export function setPKCEVerifierCookie(res: Response, verifier: string): void {
  res.cookie('pkce_verifier', verifier, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Clear OAuth transient cookies
 */
export function clearOAuthCookies(res: Response): void {
  res.clearCookie('oauth_state', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
  });

  res.clearCookie('pkce_verifier', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
  });
}

