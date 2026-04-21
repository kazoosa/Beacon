import { SignInPage } from "../components/ui/sign-in-flow-1";

/**
 * PREVIEW route for the Three.js shader sign-in. Full-screen, dark.
 * Clear banner at the top makes sure this isn't mistaken for the real
 * /login page.
 */
export function PreviewSignInPage() {
  return (
    <div className="relative">
      <div className="fixed top-0 inset-x-0 z-50 bg-amber-500/95 text-amber-950 text-xs text-center py-2 px-4 font-medium">
        PREVIEW — marketplace sign-in component. Real login is at <code>/login</code>.
      </div>
      <SignInPage />
    </div>
  );
}
