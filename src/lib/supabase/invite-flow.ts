export function destinationAfterAuthCallback(hasSession: boolean) {
  return hasSession ? "/auth/set-password" : "/login?error=link";
}

export function passwordSetupUrl(hash: string) {
  return `/auth/set-password${hash.startsWith("#") ? hash : ""}`;
}
