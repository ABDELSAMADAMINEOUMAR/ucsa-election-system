// Production student sign-up remains closed until the release owner enables
// it after security and deployment readiness gates are met.
export function isPublicRegistrationEnabled(
  nodeEnvironment = process.env.NODE_ENV,
  explicitEnable = process.env.UCSA_PUBLIC_REGISTRATION_ENABLED,
) {
  return nodeEnvironment !== "production" || explicitEnable === "true";
}
