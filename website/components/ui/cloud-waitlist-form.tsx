"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import PixelCard from "@/components/ui/pixel-card";

const interestOptions = [
  { value: "git-backed-cms", label: "Git-backed CMS" },
  { value: "answer-first-search", label: "Answer-first AI search" },
  { value: "feedback-analytics", label: "Feedback + analytics" },
  { value: "mcp-agents", label: "MCP + agent delivery" },
  { value: "api-reference", label: "API reference hosting" },
  { value: "private-docs", label: "Private docs + team controls" },
] as const;

type SubmitState =
  | { status: "idle"; message: null }
  | { status: "success"; message: string }
  | { status: "warning"; message: string }
  | { status: "error"; message: string };

export default function CloudWaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [interest, setInterest] = useState<string>(interestOptions[0].value);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: null,
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setSubmitState({ status: "idle", message: null });

    try {
      const response = await fetch("/api/cloud/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          company,
          projectUrl,
          interest,
          message,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        warning?: string;
        stored?: boolean;
      };

      if (!response.ok) {
        setSubmitState({
          status: "error",
          message: payload.error || "Failed to join the waitlist. Please try again.",
        });
        return;
      }

      setName("");
      setEmail("");
      setCompany("");
      setProjectUrl("");
      setInterest(interestOptions[0].value);
      setMessage("");

      if (payload.stored === false && payload.warning) {
        setSubmitState({
          status: "warning",
          message: payload.warning,
        });
        return;
      }

      setSubmitState({
        status: "success",
        message: "You’re on the list. We’ll reach out as the cloud preview opens.",
      });
    } catch {
      setSubmitState({
        status: "error",
        message: "Request failed before it reached the waitlist API. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PixelCard className="-mt-[34px] w-full shrink-0 border-b-0 border-t-0 border-black/10 bg-white/95 p-0 dark:border-white/10 dark:bg-black/40">
      <div className="border-b border-black/10 px-5 py-3 dark:border-white/10">
        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
          Join the waitlist
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-black dark:text-white">
          Get first access.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-black/55 dark:text-white/45">
          Tell us what should ship first and we’ll use that to shape the first release.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 mt-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="cloud-waitlist-name"
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Mekonnen"
          />
          <Field
            id="cloud-waitlist-company"
            label="Company / team"
            value={company}
            onChange={setCompany}
            placeholder="Farming Labs"
          />
        </div>

        <Field
          id="cloud-waitlist-email"
          label="Work email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="team@company.com"
          required
        />

        <Field
          id="cloud-waitlist-project"
          label="Current docs URL"
          type="url"
          value={projectUrl}
          onChange={setProjectUrl}
          placeholder="https://docs.example.com"
        />

        <div>
          <label
            htmlFor="cloud-waitlist-interest"
            className="mb-1 block text-[10px] font-mono uppercase tracking-[0.24em] text-black/45 dark:text-white/45"
          >
            What should ship first?
          </label>
          <select
            id="cloud-waitlist-interest"
            value={interest}
            onChange={(event) => setInterest(event.target.value)}
            className="w-full rounded-none border border-black/10 bg-transparent px-3 py-2 text-sm text-black outline-none transition-colors focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/25"
          >
            {interestOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-white text-black dark:bg-black"
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="cloud-waitlist-message"
            className="mb-1 block text-[10px] font-mono uppercase tracking-[0.24em] text-black/45 dark:text-white/45"
          >
            Notes
          </label>
          <textarea
            id="cloud-waitlist-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tell us what you need. CMS, GitHub sync, AI search quality, private docs, review workflows..."
            rows={5}
            className="w-full resize-none rounded-none border border-black/10 bg-transparent px-3 py-2 text-sm leading-relaxed text-black outline-none transition-colors focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/25"
          />
        </div>

        {submitState.message && (
          <p
            className={
              submitState.status === "error"
                ? "text-[11px] text-red-600 dark:text-red-400"
                : submitState.status === "warning"
                  ? "text-[11px] text-amber-700 dark:text-amber-300"
                  : "text-[11px] text-emerald-700 dark:text-emerald-300"
            }
          >
            {submitState.message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="group inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-4 py-3 text-[11px] font-mono uppercase tracking-[0.24em] text-white transition-all hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
        >
          {loading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Joining
            </>
          ) : submitState.status === "success" ? (
            <>
              <Check className="size-3.5" />
              Joined
            </>
          ) : (
            <>
              Join waitlist
              <ArrowRight className="size-3.5 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
            </>
          )}
        </button>

        {/* <p className="text-[11px] leading-relaxed text-black/45 dark:text-white/40">
          GitHub stays the source of truth. This is the layer around it.
        </p> */}
      </form>
    </PixelCard>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  type?: React.HTMLInputTypeAttribute;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[10px] font-mono uppercase tracking-[0.24em] text-black/45 dark:text-white/45"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-none border border-black/10 bg-transparent px-3 py-2 text-sm text-black outline-none transition-colors focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/25"
      />
    </div>
  );
}
