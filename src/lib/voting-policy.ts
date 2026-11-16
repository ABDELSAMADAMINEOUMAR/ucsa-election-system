/** No real-voting enable switch exists. This opt-in permits synthetic rehearsals only. */
export function isSyntheticVotingEnabled(mode: string | undefined, enabled: string | undefined) {
  return mode === "demo" && enabled === "true";
}
