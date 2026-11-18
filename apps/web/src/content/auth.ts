/**
 * Authentication copy (English).
 *
 * Kept as a typed object for the same reason as the homepage content: the shape
 * is checked by the compiler and a second locale can supply the same shape.
 * Nothing here may suggest that an account exists when authentication is not
 * configured in the current build.
 */
export const AUTH_COPY = {
  common: {
    brandPanelTitle: 'One account, every tool.',
    brandPanelBody:
      'Your dashboard holds saved results, usage history and your credit balance. The free utilities stay available either way.',
    brandPanelPoints: [
      'Email verification protects the free AI allowance',
      'Purchased credits belong to your account, not a session',
      'You can delete your account and data at any time',
    ],
    notConfiguredTitle: 'Authentication is not configured in this build',
    notConfiguredBody:
      'This environment has no Supabase project connected, so no account can be created or signed in. Forms are disabled on purpose instead of pretending to work.',
    notConfiguredSteps: [
      'Create a free Supabase project',
      'Run the migrations in supabase/migrations',
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY',
    ],
    notConfiguredDocs: 'Read the setup guide',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    emailLabel: 'Email address',
    passwordLabel: 'Password',
    confirmPasswordLabel: 'Confirm password',
    working: 'Working',
  },
  register: {
    title: 'Create your account',
    subtitle: 'Start with the free tools. Add credits only when you want AI help.',
    submit: 'Create account',
    passwordHint: 'At least 10 characters, including a letter and a number.',
    termsPrefix: 'I agree to the',
    termsLink: 'terms of service',
    termsJoin: 'and',
    privacyLink: 'privacy policy',
    termsSuffix: 'when they are published.',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
    successTitle: 'Check your inbox',
    successBody:
      'If this address can be used, we have sent a confirmation link. Open it on this device to finish setting up your account.',
    resendLink: 'Send the confirmation email again',
    resentNotice: 'A new confirmation email is on its way if that address needs one.',
  },
  login: {
    title: 'Welcome back',
    subtitle: 'Sign in to reach your dashboard, saved results and usage history.',
    submit: 'Sign in',
    forgot: 'Forgot your password?',
    noAccount: 'New to QuickBiz Studio?',
    createAccount: 'Create an account',
    unverified:
      'This email address has not been confirmed yet. Open the link we sent, or request a new one.',
    invalid: 'That email address and password combination did not work.',
    suspended: 'This account cannot sign in right now. Contact support.',
    resendVerification: 'Resend confirmation email',
  },
  forgot: {
    title: 'Reset your password',
    subtitle:
      'Enter the email address on your account. If it exists, we will send a single-use reset link.',
    submit: 'Send reset link',
    successTitle: 'Check your inbox',
    successBody:
      'If an account exists for that address, a reset link is on its way. The link expires after a short time.',
    backToLogin: 'Back to sign in',
  },
  reset: {
    title: 'Choose a new password',
    subtitle: 'Use a password you have not used elsewhere.',
    submit: 'Save new password',
    successTitle: 'Password updated',
    successBody: 'You can now sign in with your new password.',
    continue: 'Go to your dashboard',
    invalidTitle: 'This reset link cannot be used',
    invalidBody:
      'The link may have expired or already been used. Request a fresh reset email to continue.',
    requestNew: 'Request a new link',
  },
  verify: {
    title: 'Confirm your email',
    subtitle: 'We sent a confirmation link to the address you registered with.',
    body: 'Open that link on this device to activate AI features. Free tools do not need a confirmed email.',
    resend: 'Send the link again',
    resending: 'Sending',
    resent: 'If that address needs confirmation, a new link is on its way.',
    missingEmail: 'We do not know which address to resend to. Sign in and try again.',
    signedInAs: 'Signed in as',
  },
  dashboard: {
    title: 'Your account',
    welcome: 'Welcome',
    verified: 'Email confirmed',
    unverified: 'Email not confirmed',
    unverifiedBody:
      'Confirm your email address to unlock the free AI allowance when AI tools open. Free utilities will never require it.',
    resend: 'Resend confirmation',
    nextTitle: 'What happens next',
    nextBody:
      'Tool pages, the credit wallet and usage history arrive in the next build stages. This dashboard is intentionally empty until those exist.',
    profileLink: 'Edit your profile',
    signOut: 'Sign out',
    accountDetails: 'Account details',
    memberSince: 'Member since',
    userId: 'User ID',
  },
  profile: {
    title: 'Profile',
    subtitle: 'This information appears on your account and, later, on saved results.',
    displayName: 'Display name',
    displayNameHint: 'Between 2 and 60 characters.',
    avatarUrl: 'Avatar image URL',
    avatarUrlHint: 'Optional. Must start with https://.',
    language: 'Preferred language',
    save: 'Save changes',
    saving: 'Saving',
    saved: 'Profile updated',
    readOnlyTitle: 'Managed by your account',
    readOnlyBody:
      'Your email address and user ID are controlled by authentication. Changing your email is done from the sign-in screen, not here.',
    emailLabel: 'Email address',
    userIdLabel: 'User ID',
    createdAtLabel: 'Created',
    updatedAtLabel: 'Last updated',
    unverifiedNotice: 'This account has not confirmed its email address yet.',
    loadFailed: 'We could not load your profile. Refresh the page to try again.',
    saveFailed: 'Your changes were not saved. Please try again.',
  },
  account: {
    dashboard: 'Dashboard',
    profile: 'Profile',
    signOut: 'Sign out',
    signingOut: 'Signing out',
    menu: 'Account menu',
  },
  errors: {
    notConfigured: 'Authentication is not configured in this build.',
    network: 'We could not reach the authentication service. Check your connection and try again.',
    rateLimited: 'Too many attempts. Wait a moment before trying again.',
    weakPassword: 'Choose a stronger password.',
    samePassword: 'Choose a password you have not used on this account before.',
    expiredLink: 'That link has expired. Request a new one.',
    generic: 'Something went wrong. Please try again.',
  },
} as const;
