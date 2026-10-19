/** Every gate is server-owned and fails closed. Product cards never depend on these flags. */
export function akiSuiteCheckoutReady(): boolean {
  return (
    [
      "AKISUITE_CHECKOUT_ENABLED",
      "AKISUITE_TAX_READY",
      "AKISUITE_SUBSCRIPTIONS_READY",
      "AKISUITE_FEATURES_READY",
      "AKISUITE_BILLING_VERIFIED",
    ].every((key) => process.env[key] === "true") &&
    process.env.AKISUITE_STRIPE_ACCOUNT_ID === "acct_1SVLH2GfzDhsgsQZ"
  );
}
