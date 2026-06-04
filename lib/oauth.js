const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_KEY = 'googleToken';

export async function getAuthToken(interactive = false) {
  const { [TOKEN_KEY]: token } = await chrome.storage.local.get(TOKEN_KEY);
  if (token && token.accessToken && token.expiresAt > Date.now() + 60_000) {
    return token.accessToken;
  }
  if (!interactive) {
    throw new Error('Google token expired; reconnect in options');
  }
  return runAuthFlow();
}

async function runAuthFlow() {
  const manifest = chrome.runtime.getManifest();
  const clientId = manifest.oauth2?.client_id;
  if (!clientId || clientId.startsWith('REPLACE_')) {
    throw new Error('Set oauth2.client_id in manifest.json first');
  }

  const redirectUri = chrome.identity.getRedirectURL();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', SCOPES.join(' '));
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');

  const responseUrl = await new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: url.toString(), interactive: true },
      (out) => {
        if (chrome.runtime.lastError || !out) {
          reject(new Error(chrome.runtime.lastError?.message || 'Auth cancelled'));
        } else {
          resolve(out);
        }
      }
    );
  });

  const parsed = new URL(responseUrl);
  const params = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
  if (!accessToken) {
    const err = params.get('error') || 'No access_token returned';
    throw new Error(err);
  }

  await chrome.storage.local.set({
    [TOKEN_KEY]: {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000
    }
  });
  return accessToken;
}

export async function removeCachedAuthToken() {
  await chrome.storage.local.remove(TOKEN_KEY);
}

export async function clearAllTokens() {
  await chrome.storage.local.remove(TOKEN_KEY);
}

export function getRedirectUri() {
  return chrome.identity.getRedirectURL();
}
