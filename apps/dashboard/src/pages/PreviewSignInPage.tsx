import { SignInPage } from "../components/ui/sign-in-flow-1";

/**
 * The live sign-in / sign-up page. Full-screen Three.js shader background.
 * Wired to /login and /register. (Historically this was the preview route;
 * the banner has been retired now that it's the real thing.)
 */
export function PreviewSignInPage() {
  return <SignInPage />;
}
