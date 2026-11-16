// Test-only constructor. No application endpoint, flag, or production authority.
// Uses already-created fictional accounts and retains append-only evidence.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
export async function boundFixture(
  admin: SupabaseClient,
  userIds: string[],
  electionIds: string[] = [],
  activate = true,
  officialIdentity?: { registrationNumber: string; fullName: string },
) {
  if (
    !/^http:\/\/(127\.0\.0\.1|localhost):55021$/.test(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    )
  )
    throw new Error("Fictional fixtures require the UCSA local stack.");
  const check = (r: { error: unknown }) => {
    if (r.error)
      throw new Error("Official fixture setup failed; no credentials printed.");
  };
  const latest = await admin
    .from("official_registers")
    .select("id")
    .eq("status", "locked")
    .order("approved_at", { ascending: false })
    .limit(1);
  check(latest);
  const existing = latest.data?.length
    ? await admin
        .from("official_register_entries")
        .select("identity_id,registration_number,email,full_name")
        .eq("register_id", latest.data[0].id)
        .range(0, 999)
    : { data: [], error: null };
  check(existing);
  const records = [...(existing.data ?? [])];
  const fresh: {
    id: string;
    email: string;
    name: string;
    registration: string;
  }[] = [];
  for (const id of userIds) {
    const auth = await admin.auth.admin.getUserById(id);
    check(auth);
    if (!auth.data.user?.email?.endsWith("@example.test"))
      throw new Error("Only fictional test identities may be bound.");
    const bound = await admin
      .from("voter_bindings")
      .select("user_id")
      .eq("user_id", id)
      .maybeSingle();
    check(bound);
    if (bound.data) continue;
    const profile = await admin
      .from("profiles")
      .select("full_name,registration_number")
      .eq("id", id)
      .single();
    check(profile);
    const email = auth.data.user.email.toLowerCase();
    const name =
      officialIdentity?.fullName ||
      profile.data?.full_name ||
      "Synthetic Student";
    const registration =
      officialIdentity?.registrationNumber ||
      profile.data?.registration_number ||
      `T-${id.replaceAll("-", "")}`;
    fresh.push({ id, email, name, registration });
    records.push({
      identity_id: id,
      registration_number: registration,
      email,
      full_name: name,
    });
  }
  const actor = userIds[0];
  let registerId = latest.data?.[0]?.id;
  if (fresh.length || !registerId) {
    registerId = randomUUID();
    const snapshot = records.map((r) => ({
      fullName: r.full_name,
      registrationNumber: r.registration_number,
      email: r.email,
    }));
    const hash = createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex");
    // PostgreSQL jsonb::text uses length-ordered keys and spaced separators.
    // Keep this fixed three-string fixture shape integrity-verifiable too.
    const normalizedSnapshot = `[${snapshot
      .map(
        (row) =>
          `{"email": ${JSON.stringify(row.email)}, "fullName": ${JSON.stringify(row.fullName)}, "registrationNumber": ${JSON.stringify(row.registrationNumber)}}`,
      )
      .join(", ")}]`;
    const snapshotHash = createHash("sha256")
      .update(normalizedSnapshot)
      .digest("hex");
    check(
      await admin.from("official_registers").insert({
        id: registerId,
        title: `Synthetic browser fixture ${registerId.slice(0, 8)}`,
        classification: "synthetic",
        status: "locked",
        membership_opens: new Date(Date.now() - 172800000).toISOString(),
        membership_closes: new Date(Date.now() - 86400000).toISOString(),
        activation_opens: new Date(Date.now() - 3600000).toISOString(),
        activation_closes: new Date(Date.now() + 86400000).toISOString(),
        file_name: "fixture.json",
        source_sha256: hash,
        rows_snapshot: snapshot,
        snapshot_sha256: snapshotHash,
        request_key: randomUUID(),
        created_by: actor,
        approved_by: actor,
        approved_at: new Date().toISOString(),
      }),
    );
    for (const person of fresh) {
      check(await admin.from("voter_identities").insert({ id: person.id }));
      check(
        await admin.from("voter_identifiers").insert([
          {
            kind: "registration",
            value: person.registration,
            identity_id: person.id,
          },
          { kind: "email", value: person.email, identity_id: person.id },
        ]),
      );
    }
    check(
      await admin
        .from("official_register_entries")
        .insert(records.map((r) => ({ ...r, register_id: registerId }))),
    );
    if (activate)
      for (const person of fresh)
        check(
          await admin.from("voter_bindings").insert({
            user_id: person.id,
            identity_id: person.id,
            register_id: registerId,
            proof_email: person.email,
          }),
        );
  }
  for (const electionId of electionIds) {
    const present = await admin
      .from("election_registers")
      .select("election_id")
      .eq("election_id", electionId)
      .maybeSingle();
    check(present);
    if (!present.data) {
      check(
        await admin.from("election_classifications").insert({
          election_id: electionId,
          classification: "synthetic",
          classified_by: actor,
        }),
      );
      check(
        await admin.from("election_registers").insert({
          election_id: electionId,
          register_id: registerId,
          rule_reference: "Approved synthetic fixture eligibility",
          approved_by: actor,
        }),
      );
      check(
        await admin.from("register_election_decisions").insert(
          records.map((r) => ({
            election_id: electionId,
            register_id: registerId,
            identity_id: r.identity_id,
            included: true,
          })),
        ),
      );
    }
    const election = await admin
      .from("elections")
      .select("status")
      .eq("id", electionId)
      .single();
    check(election);
    const candidates = await admin
      .from("candidate_applications")
      .select("id")
      .eq("election_id", electionId)
      .eq("status", "approved");
    check(candidates);
    if (
      candidates.data?.length &&
      ["open", "closed", "certified"].includes(election.data?.status)
    ) {
      const presentSlate = await admin
        .from("candidate_slates")
        .select("election_id")
        .eq("election_id", electionId)
        .maybeSingle();
      if (!presentSlate.data)
        check(
          await admin.from("candidate_slates").insert({
            election_id: electionId,
            finalized_by: actor,
            candidate_ids: candidates.data.map((r) => r.id),
            snapshot_sha256: createHash("sha256")
              .update(
                candidates.data
                  .map((r) => r.id)
                  .sort()
                  .join(","),
              )
              .digest("hex"),
          }),
        );
    }
  }
  return registerId!;
}
/** Append-only binding history deliberately retains these test-owned Auth rows. */
export async function retainFixtureAuth(id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id))
    throw new Error("Invalid fixture reference");
  return { data: null, error: null, retained: true };
}
