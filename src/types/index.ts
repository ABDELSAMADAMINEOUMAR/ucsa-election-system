export type ReviewStatus = "Pending" | "Approved" | "Rejected";
export type ElectionStatus =
  | "Draft"
  | "Prepared"
  | "Open"
  | "Closed"
  | "Pending certification"
  | "Certified";
export type Office = "President" | "Secretary General" | "Treasurer";
export type Candidate = {
  id: string;
  name: string;
  registration: string;
  email: string;
  phone: string;
  office: Office;
  bio: string;
  manifesto: string;
  priorities: string[];
  status: ReviewStatus;
  reason?: string;
  photo?: string;
};
export type Voter = {
  id: string;
  name: string;
  registration: string;
  email: string;
  faculty: string;
  year: number;
  status: "Verified" | "Pending" | "Ineligible";
  reason?: string;
};
export type Complaint = {
  id: string;
  subject: string;
  category: string;
  message: string;
  status: "New" | "Under review" | "Resolved";
  date: string;
  resolution?: string;
};
export type Election = {
  title: string;
  description: string;
  nominationsStart: string;
  nominationsEnd: string;
  votingStart: string;
  votingEnd: string;
  offices: Office[];
  status: ElectionStatus;
};
export type Activity = { id: string; text: string; time: string };
