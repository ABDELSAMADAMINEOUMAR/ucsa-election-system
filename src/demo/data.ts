import type { Candidate, Complaint, Election, Office, Voter } from "@/types";

export const offices: Office[] = [
  "President",
  "Secretary General",
  "Treasurer",
];
export const demoStudent = {
  name: "Mariam Hassan",
  registration: "DEMO-2026-001",
  email: "mariam@example.test",
  phone: "+250 780 000 001",
};
export const initialElection: Election = {
  title: "UCSA General Election 2026",
  description:
    "Together, we choose the next chapter. Elect the student leaders who will represent our community.",
  nominationsStart: "2026-11-02",
  nominationsEnd: "2026-11-12",
  votingStart: "2026-11-20T08:00",
  votingEnd: "2026-11-20T18:00",
  offices: [...offices],
  status: "Draft",
};
const names = [
  "Amina Mahamat",
  "Ibrahim Saleh",
  "Grace Djamal",
  "Patrick Moussa",
  "Fatima Abakar",
  "Jean Adoum",
  "Nadia Brahim",
  "Hassan Ali",
  "Sarah Oumar",
];
export const initialCandidates: Candidate[] = names.map((name, i) => ({
  id: `candidate-${i + 1}`,
  name,
  registration: `DEMO-2026-${String(i + 10).padStart(3, "0")}`,
  email: `candidate${i + 1}@example.test`,
  phone: "+250 780 000 000",
  office: offices[Math.floor(i / 3)],
  bio: `${name} is a fictional UNILAK student passionate about bringing our community together through practical, inclusive student leadership.`,
  manifesto:
    "Every student deserves to feel heard, supported, and connected. My vision is an association that turns ideas into opportunities: a peer mentorship network, transparent communication, and meaningful cultural and academic activities. I will listen to our members, share regular progress updates, and work with the committee to make student life better for everyone.",
  priorities: [
    "A stronger student support network",
    "Transparent communication and accountability",
    "More academic and cultural opportunities",
  ],
  status: [0, 1, 3, 6].includes(i) ? "Approved" : "Pending",
}));
export const initialVoters: Voter[] = [
  demoStudent.name,
  "Adam Youssouf",
  "Halima Issa",
  "David Mahamat",
  "Khadija Saleh",
  "Ousmane Abakar",
  "Nour Hassan",
  "Yacine Ali",
  "Salma Moussa",
  "Abdel Djamal",
  "Rebeca Oumar",
  "Moussa Brahim",
].map((name, i) => ({
  id: `voter-${i + 1}`,
  name,
  registration: `DEMO-2026-${String(i + 1).padStart(3, "0")}`,
  email: `student${i + 1}@example.test`,
  faculty: ["Computing & IT", "Business Administration", "Law"][i % 3],
  year: (i % 4) + 1,
  status: i < 8 ? "Verified" : i < 10 ? "Pending" : "Ineligible",
  reason:
    i >= 10
      ? "Enrollment confirmation is missing in this fictional record."
      : undefined,
}));
export const initialComplaints: Complaint[] = [
  {
    id: "CMP-001",
    subject: "Registration number needs correction",
    category: "Voter eligibility",
    message:
      "My registration number appears incorrectly in the demo eligibility list. Please review the record before voting opens.",
    status: "New",
    date: "2026-11-06",
  },
  {
    id: "CMP-002",
    subject: "Clarification on nomination deadline",
    category: "Election process",
    message:
      "Could the committee clarify when candidate applications close and when the review decisions will be available?",
    status: "Under review",
    date: "2026-11-05",
  },
  {
    id: "CMP-003",
    subject: "Candidate profile information updated",
    category: "Candidate information",
    message:
      "The candidate biography required an update. This example has been reviewed and the correction is complete.",
    status: "Resolved",
    date: "2026-11-04",
    resolution: "The fictional profile was reviewed and updated.",
  },
];
// An independent, fictional completed election. These totals never change when a ballot demo is completed.
export const publishedResults = offices.map((office, index) => ({
  office,
  entries: names.slice(index * 3, index * 3 + 3).map((name, i) => ({
    name,
    votes: [110, 60, 30][i],
    percentage: [55, 30, 15][i],
  })),
}));
