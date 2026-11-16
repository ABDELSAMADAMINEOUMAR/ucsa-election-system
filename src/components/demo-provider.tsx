"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  demoStudent,
  initialCandidates,
  initialComplaints,
  initialElection,
  initialVoters,
} from "@/demo/data";
import type { Activity, Candidate, Complaint, Election, Voter } from "@/types";

function useDemoState() {
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [voters, setVoters] = useState<Voter[]>(initialVoters);
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);
  const [election, setElection] = useState<Election>(initialElection);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  // Ballots are deliberately memory-only: no browser storage, API, logging, or tally mutation.
  const [ballot, setBallot] = useState<Record<string, string>>({});
  const [ballotComplete, setBallotComplete] = useState(false);
  const [activity, setActivity] = useState<Activity[]>([
    {
      id: "seed-1",
      text: "Demo workspace is ready to explore",
      time: "Sample activity",
    },
    {
      id: "seed-2",
      text: "Candidate applications opened",
      time: "2 Nov 2026 · Sample",
    },
  ]);
  const [notice, setNotice] = useState("");
  function log(text: string) {
    setActivity((prev) =>
      [
        { id: crypto.randomUUID(), text, time: "This demo session" },
        ...prev,
      ].slice(0, 20),
    );
    setNotice(text);
  }
  function reset() {
    setCandidates(initialCandidates);
    setVoters(initialVoters);
    setComplaints(initialComplaints);
    setElection(initialElection);
    setApplicationId(null);
    setBallot({});
    setBallotComplete(false);
    setActivity([]);
    setNotice("Demo workspace reset.");
  }
  return {
    candidates,
    setCandidates,
    voters,
    setVoters,
    complaints,
    setComplaints,
    election,
    setElection,
    applicationId,
    setApplicationId,
    ballot,
    setBallot,
    ballotComplete,
    setBallotComplete,
    activity,
    log,
    notice,
    setNotice,
    reset,
    student: demoStudent,
  };
}
type DemoContextType = ReturnType<typeof useDemoState> & {
  officialLogoAvailable: boolean;
};
const DemoContext = createContext<DemoContextType | null>(null);
export function DemoProvider({
  children,
  officialLogoAvailable = false,
}: {
  children: ReactNode;
  officialLogoAvailable?: boolean;
}) {
  const state = useDemoState();
  return (
    <DemoContext.Provider value={{ ...state, officialLogoAvailable }}>
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("DemoProvider is required.");
  return ctx;
}
