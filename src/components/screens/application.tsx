"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  ImagePlus,
  Send,
} from "lucide-react";
import { applicationSchema } from "@/lib/schemas";

import { useDemo } from "../demo-provider";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeading,
  EmptyState,
  Modal,
  Notice,
  PageHeader,
} from "../ui";

type ApplicationValues = z.infer<typeof applicationSchema>;
export function ApplicationForm() {
  const demo = useDemo();
  const router = useRouter();
  const [photo, setPhoto] = useState<string>();
  const [photoError, setPhotoError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [review, setReview] = useState<ApplicationValues | null>(null);
  const photoRef = useRef<string | undefined>(undefined);
  const photoFileRef = useRef<File | undefined>(undefined);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplicationValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      ...demo.student,
      office: demo.election.offices[0],
      bio: "",
      manifesto: "",
      consent: false,
    },
  });
  useEffect(
    () => () => {
      if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    },
    [],
  );
  const existing = demo.candidates.find((c) => c.id === demo.applicationId);
  function selectPhoto(file?: File) {
    setPhotoError("");
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setPhotoError("Select a JPEG, PNG, or WebP image smaller than 2 MB.");
      return;
    }
    if (photoRef.current) URL.revokeObjectURL(photoRef.current);
    const url = URL.createObjectURL(file);
    photoRef.current = url;
    photoFileRef.current = file;
    setPhoto(url);
  }
  async function submit() {
    if (!review || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    const id = `demo-application-${crypto.randomUUID()}`;
    let demoPhoto: string | undefined;
    if (photoFileRef.current) {
      const file = photoFileRef.current;
      demoPhoto = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Photo could not be read."));
        reader.onabort = () => reject(new Error("Photo reading was interrupted."));
        reader.readAsDataURL(file);
      });
    }
    demo.setCandidates((prev) => [
      ...prev,
      {
        id,
        ...review,
        photo: demoPhoto,
        status: "Pending",
        priorities: [
          "Community support",
          "Transparent leadership",
          "Student opportunities",
        ],
      },
    ]);
    demo.setApplicationId(id);
    demo.log("Demo candidacy application received.");
    setReview(null);
    router.push("/student/application-status");
  }
  if (existing)
    return (
      <>
        <PageHeader
          title="Your application is in progress"
          description="You have already submitted a fictional application in this session."
        />
        <Card>
          <EmptyState
            title="Follow your next step"
            description="The committee demo can approve or reject your application, and you can follow the result here."
            action={
              <ButtonLink href="/student/application-status">
                View application status
                <ArrowRight size={16} />
              </ButtonLink>
            }
          />
        </Card>
      </>
    );
  const error = (name: keyof ApplicationValues) =>
    errors[name] ? (
      <span id={`${name}-error`} className="field-error" role="alert">
        {errors[name]?.message}
      </span>
    ) : null;
  const a11y = (name: keyof ApplicationValues) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  return (
    <>
      <PageHeader
        eyebrow="STUDENT / CANDIDACY"
        title="Big ideas start with you."
        description="Tell us about your vision for UCSA. This application is a simulation."
        back="/student"
      />
      <div className="form-layout">
        <form
          noValidate
          onSubmit={handleSubmit((data) => setReview(data))}
          className="stack"
        >
          <Notice tone="yellow">
            Demo only. Use fictional information. Nothing is sent to a server;
            all data is cleared when the page reloads.
          </Notice>
          <Card>
            <CardHeading
              title="01 / Your information"
              description="Your demo profile is filled in to get you started."
            />
            <div className="form-grid">
              {(
                [
                  { name: "name", label: "Full name", type: "text" },
                  {
                    name: "registration",
                    label: "Student registration number",
                    type: "text",
                  },
                  { name: "email", label: "Email address", type: "email" },
                  { name: "phone", label: "Phone number", type: "tel" },
                ] as const
              ).map((f) => (
                <label className="field" key={f.name}>
                  {f.label}
                  <input
                    type={f.type}
                    {...register(f.name)}
                    aria-label={f.label}
                    {...a11y(f.name)}
                  />
                  {error(f.name)}
                </label>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeading
              title="02 / Your candidacy"
              description="Choose an office and introduce the person behind the vision."
            />
            <div className="stack">
              <label className="field">
                Contested office
                <select
                  {...register("office")}
                  {...a11y("office")}
                  aria-label="Contested office"
                >
                  {demo.election.offices.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
                {error("office")}
              </label>
              <div className="photo-upload">
                <Avatar name={demo.student.name} photo={photo} large />
                <label className="field">
                  <span>
                    <ImagePlus size={18} />
                    Candidate photograph{" "}
                    <span className="muted small">(optional)</span>
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => selectPhoto(e.target.files?.[0])}
                    aria-describedby="photo-help"
                  />
                  <small id="photo-help" className="muted">
                    JPEG, PNG, or WebP · Maximum 2 MB · Local preview only
                  </small>
                  {photoError && (
                    <span className="field-error" role="alert">
                      {photoError}
                    </span>
                  )}
                </label>
              </div>
              <label className="field">
                Biography
                <textarea
                  rows={4}
                  placeholder="Introduce yourself and your experience…"
                  {...register("bio")}
                  aria-label="Biography"
                  {...a11y("bio")}
                />
                <span className="muted small">30–1,000 characters</span>
                {error("bio")}
              </label>
              <label className="field">
                Your manifesto
                <textarea
                  rows={6}
                  placeholder="What would you like to change? Share your priorities and your plan…"
                  {...register("manifesto")}
                  aria-label="Your manifesto"
                  {...a11y("manifesto")}
                />
                <span className="muted small">80–5,000 characters</span>
                {error("manifesto")}
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  {...register("consent")}
                  {...a11y("consent")}
                />
                <span>
                  I understand this is a fictional application simulation and
                  contains no real student information.
                </span>
              </label>
              {error("consent")}
            </div>
          </Card>
          <div className="form-actions">
            <ButtonLink href="/student" secondary>
              Cancel
            </ButtonLink>
            <Button type="submit">
              Review application
              <ArrowRight size={17} />
            </Button>
          </div>
        </form>
        <aside className="stack">
          <Card className="application-guide">
            <span className="icon-box blue">
              <Send size={23} />
            </span>
            <h2>
              A little preparation.
              <br />A lasting impact.
            </h2>
            <p className="muted">
              Great leadership begins with a clear vision and a commitment to
              your community.
            </p>
            <ul className="check-list">
              <li>
                <Check size={17} />
                Choose one leadership office
              </li>
              <li>
                <Check size={17} />
                Tell your story honestly
              </li>
              <li>
                <Check size={17} />
                Make your priorities clear
              </li>
              <li>
                <Check size={17} />
                Review before submitting
              </li>
            </ul>
          </Card>
          <Notice>
            Your application status can be updated from the committee demo.
            Switch roles in the header to try the full review journey.
          </Notice>
        </aside>
      </div>
      <Modal
        open={!!review}
        onOpenChange={(open) => {
          if (!open) setReview(null);
        }}
        title="Review your demo application"
        description="Step 2 of 2 · Check your details before completing the simulation."
      >
        {review && (
          <div className="stack">
            <div className="person-row">
              <Avatar name={review.name} photo={photo} />
              <div>
                <strong>{review.name}</strong>
                <p className="muted">{review.office}</p>
              </div>
            </div>
            <dl className="details-list">
              <div>
                <dt>Registration</dt>
                <dd>{review.registration}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{review.email}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{review.phone}</dd>
              </div>
            </dl>
            <h3>Biography</h3>
            <p className="prose">{review.bio}</p>
            <h3>Manifesto</h3>
            <p className="prose">{review.manifesto}</p>
            <Notice tone="yellow">
              Local demo only. No real candidacy application will be submitted.
            </Notice>
            {submitError && (
              <p className="field-error" role="alert">
                {submitError}
              </p>
            )}
            <div className="dialog-actions">
              <Button variant="secondary" onClick={() => setReview(null)}>
                Edit details
              </Button>
              <Button
                disabled={submitting}
                onClick={() =>
                  void submit().catch(() => {
                    setSubmitting(false);
                    setSubmitError(
                      "Could not read the selected photo. Please select it again.",
                    );
                  })
                }
              >
                {submitting ? "Completing simulation…" : "Complete simulation"}
                <CheckCheck size={17} />
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export function ApplicationStatus() {
  const demo = useDemo();
  const application = demo.candidates.find((c) => c.id === demo.applicationId);
  if (!application)
    return (
      <>
        <PageHeader
          title="Your candidacy journey"
          description="Start with an idea. Take the next step."
        />
        <Card>
          <EmptyState
            title="No demo application yet"
            description="Complete the application simulation to see its review status here."
            action={
              <ButtonLink href="/student/apply">
                Start an application
                <ArrowRight size={17} />
              </ButtonLink>
            }
          />
        </Card>
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="STUDENT / APPLICATION STATUS"
        title={
          application.status === "Approved"
            ? "Your vision is ready to share."
            : application.status === "Rejected"
              ? "Your application has been reviewed."
              : "Your next chapter is taking shape."
        }
        description="Follow your fictional application through the committee review process."
        back="/student"
      />
      <div className="profile-layout">
        <Card className="profile-summary">
          <Avatar name={application.name} photo={application.photo} large />
          <h2>{application.name}</h2>
          <span className="profile-office">{application.office}</span>
          <Badge>{application.status}</Badge>
          <p className="muted small">Demo application · In-memory session</p>
          <Link href="/committee/candidates" className="text-link">
            Try committee review
            <ArrowRight size={16} />
          </Link>
        </Card>
        <div className="stack">
          <Notice tone={application.status === "Approved" ? "green" : "yellow"}>
            <strong>
              {application.status === "Pending"
                ? "Awaiting committee review"
                : application.status === "Approved"
                  ? "Approved in this simulation"
                  : "Not approved in this simulation"}
            </strong>
            <p>
              {application.reason ||
                (application.status === "Pending"
                  ? "The demo committee will review your profile, eligibility, and manifesto."
                  : "Your fictional candidate profile is now visible in the candidate directory.")}
            </p>
          </Notice>
          <Card>
            <CardHeading title="Application progress" />
            <ol className="timeline">
              <li className="done">
                <span className="timeline-node">
                  <Check size={13} />
                </span>
                <div>
                  <strong>Application received</strong>
                  <span className="muted small">
                    Simulation completed successfully
                  </span>
                </div>
              </li>
              <li className={application.status !== "Pending" ? "done" : ""}>
                <span className="timeline-node">
                  {application.status !== "Pending" ? (
                    <Check size={13} />
                  ) : (
                    <Clock3 size={13} />
                  )}
                </span>
                <div>
                  <strong>Committee verification</strong>
                  <span className="muted small">
                    {application.status === "Pending"
                      ? "Pending eligibility and profile review"
                      : "Demo review complete"}
                  </span>
                </div>
              </li>
              <li>
                <span className="timeline-node">3</span>
                <div>
                  <strong>Final decision</strong>
                  <span className="muted small">
                    {application.status === "Pending"
                      ? "Waiting for the demo committee"
                      : application.status}
                  </span>
                </div>
              </li>
            </ol>
          </Card>
          <Card>
            <CardHeading title="Your submitted vision" />
            <h3>Biography</h3>
            <p className="prose">{application.bio}</p>
            <h3 className="mt-4">Manifesto</h3>
            <p className="prose">{application.manifesto}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
