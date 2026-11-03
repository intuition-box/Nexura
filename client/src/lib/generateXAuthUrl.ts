import cryptoRandomString from "crypto-random-string";
import { apiRequestV2 } from "./queryClient";
import { BACKEND_URL, VITE_X_CLIENT_ID } from "./constants";

function base64url(buffer: Uint8Array) {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return base64url(array);
}

async function generateCodeChallenge(verifier: string) {
  const data = new TextEncoder().encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(digest));
}


/** Set before sending a Studio admin to X, so the callback links the hub and returns to Studio. */
export const STUDIO_X_RETURN_KEY = "nexura:studio-x-return";

export const getAuthUrl = async () => {

	const state: string = cryptoRandomString({ length: 22 });

	const codeVerifier = generateCodeVerifier();
  const CODE_CHALLENGE = await generateCodeChallenge(codeVerifier);

  await apiRequestV2("GET", `/api/save-cv?codeVerifier=${codeVerifier}&state=${state}`);

  return `https://x.com/i/oauth2/authorize?response_type=code&client_id=${VITE_X_CLIENT_ID}&redirect_uri=${encodeURIComponent(BACKEND_URL + "/api/auth/x/callback")}&scope=like.read%20users.read%20offline.access%20tweet.read%20follows.read&state=${state}&code_challenge=${CODE_CHALLENGE}&code_challenge_method=S256`;
};
