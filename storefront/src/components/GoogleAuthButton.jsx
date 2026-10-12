import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

// Production has no VITE_GOOGLE_CLIENT_ID configured yet (the backend
// returns 503 for Google login without one) — showing the button anyway
// would just be a button that always fails. Rendering nothing when it's
// unset also means GoogleOAuthProvider never mounts, so the Google Identity
// Services script (~100 KB, mostly unused) never loads either. Scoped to
// just LoginPage/RegisterPage (both lazy-loaded) rather than wrapping the
// whole app, so no other route pays for it even when it is configured.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export const hasGoogleAuth = Boolean(CLIENT_ID);

export default function GoogleAuthButton({ onSuccess, onError }) {
  if (!CLIENT_ID) return null;
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <GoogleLogin onSuccess={onSuccess} onError={onError} useOneTap shape="rectangular" theme="filled_black" />
    </GoogleOAuthProvider>
  );
}
