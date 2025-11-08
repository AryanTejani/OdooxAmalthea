import { Router, Request, Response, NextFunction } from 'express';
import * as googleClient from './google.client';
import * as googleService from './google.service';
import { setOAuthStateCookie, setPKCEVerifierCookie, clearOAuthCookies, setAuthCookies } from '../../utils/cookies';
import { getOAuthAllowedRedirects } from '../../config/env';
import { AppError } from '../../middleware/errors';
import { logger } from '../../config/logger';
import { oauthRateLimit } from '../../middleware/rateLimit';

const router = Router();

/**
 * Start Google OAuth flow
 * GET /api/auth/google
 */
router.get('/', oauthRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Generate state and PKCE verifier
    const state = googleClient.generateState();
    const codeVerifier = googleClient.generateCodeVerifier();
    const codeChallenge = googleClient.generateCodeChallenge(codeVerifier);

    // Store state and verifier in httpOnly cookies (10 minutes)
    setOAuthStateCookie(res, state);
    setPKCEVerifierCookie(res, codeVerifier);

    // Build authorization URL
    const authUrl = await googleClient.buildAuthorizationUrl(state, codeChallenge);

    logger.info('Starting Google OAuth flow');

    // Redirect to Google
    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

/**
 * Google OAuth callback
 * GET /api/auth/google/callback
 */
router.get('/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state } = req.query;

    // Validate state
    const storedState = req.cookies.oauth_state;
    if (!storedState || storedState !== state) {
      throw new AppError('INVALID_STATE', 'Invalid OAuth state', 400);
    }

    // Get code verifier
    const codeVerifier = req.cookies.pkce_verifier;
    if (!codeVerifier) {
      throw new AppError('NO_CODE_VERIFIER', 'PKCE code verifier not found', 400);
    }

    // Validate code
    if (!code || typeof code !== 'string') {
      throw new AppError('NO_CODE', 'Authorization code not found', 400);
    }

    // Clear OAuth cookies
    clearOAuthCookies(res);

    // Exchange code for tokens and get user info
    const googleProfile = await googleClient.exchangeCodeForTokens(code, codeVerifier);

    // Get user agent and IP
    const userAgent = req.headers['user-agent'] || 'unknown';
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';

    // Handle OAuth callback (create/link user, create session)
    const result = await googleService.handleGoogleCallback(googleProfile, userAgent, ip);

    // Set auth cookies
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    logger.info({ userId: result.user.id }, 'Google OAuth completed successfully');

    // Redirect to frontend
    const allowedRedirects = getOAuthAllowedRedirects();
    const redirectUrl = `${allowedRedirects[0]}/profile`;

    res.redirect(redirectUrl);
  } catch (error) {
    logger.error({ error }, 'Google OAuth callback error');
    
    // Redirect to frontend with error
    const allowedRedirects = getOAuthAllowedRedirects();
    const errorUrl = `${allowedRedirects[0]}/login?error=oauth_failed`;
    
    res.redirect(errorUrl);
  }
});

export default router;

