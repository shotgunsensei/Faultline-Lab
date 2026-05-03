import { SignIn, useUser, useClerk } from '@clerk/react';
import ShotgunNinjasSSOButton from './auth/ShotgunNinjasSSOButton';

export default function AuthScreen() {
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  if (isSignedIn) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-orange-50 p-4">
        <div className="w-full max-w-md rounded-lg border border-orange-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900">Signed in to TorqueShed</h1>
          <p className="mt-2 text-sm text-gray-600">
            Welcome back, {user?.primaryEmailAddress?.emailAddress ?? user?.id}.
          </p>
          <p className="mt-4 text-xs text-gray-500 font-mono">
            User id: <code>{user?.id}</code>
          </p>
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-4 w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500"
            data-testid="button-sign-out"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-orange-50 p-4">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">TorqueShed</h1>
        <p className="text-xs text-gray-500 font-mono">staging — Shotgun Ninjas SSO PoC</p>
      </div>
      <div className="w-full max-w-md">
        <SignIn
          signUpUrl="#sign-up"
          appearance={{
            elements: {
              rootBox: 'w-full',
              cardBox: 'shadow-none',
              card: 'bg-white border border-orange-200 shadow-sm',
            },
          }}
        />
        <ShotgunNinjasSSOButton productSlug="torqueshed" />
      </div>
    </div>
  );
}
