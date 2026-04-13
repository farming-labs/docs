"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import PixelCard from "@/components/ui/pixel-card";

const interestOptions = [
  { value: "git-backed-cms", label: "Git-backed CMS" },
  { value: "ai-drafting", label: "AI drafting + review" },
  { value: "custom-branding", label: "Custom docs theme" },
  { value: "outsource-knowldege-graph", label: "Synced knowledge graph" },
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

type ButtonMode = "idle" | "loading" | "success";

export default function CloudWaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [interest, setInterest] = useState<string>(interestOptions[0].value);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [buttonMode, setButtonMode] = useState<ButtonMode>("idle");
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
    message: null,
  });

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (buttonMode === "success") {
      return;
    }

    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }

    setLoading(true);
    setButtonMode("loading");
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
        setButtonMode("idle");
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
        setButtonMode("idle");
        setSubmitState({
          status: "warning",
          message: payload.warning,
        });
        return;
      }

      setButtonMode("success");
      setSubmitState({
        status: "success",
        message: "You’re on the list. We’ll reach out as the cloud preview opens.",
      });

      successTimeoutRef.current = setTimeout(() => {
        setButtonMode("idle");
      }, 5000);
    } catch {
      setButtonMode("idle");
      setSubmitState({
        status: "error",
        message: "Request failed before it reached the waitlist API. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PixelCard className="w-full shrink-0 border-b sm:border-b-0 border-t sm:border-t-0 border-black/10 bg-white/95 p-0 lg:-mt-[39px] dark:border-white/10 dark:bg-black/40">
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
        <button
          type="submit"
          disabled={loading || buttonMode === "success"}
          className="group inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-4 py-3 text-[11px] font-mono uppercase tracking-wide text-white transition-all hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
        >
          <span className="relative h-4 overflow-hidden">
            <span
              className="flex flex-col transition-transform duration-500 ease-out"
              style={{
                transform:
                  buttonMode === "idle"
                    ? "translateY(0)"
                    : buttonMode === "loading"
                      ? "translateY(-1rem)"
                      : "translateY(-2rem)",
              }}
            >
              <span className="flex h-4 items-center justify-center gap-2">
                Join waitlist
                <ArrowRight className="size-3.5 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
              </span>
              <span className="flex h-4 items-center justify-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                Joining
              </span>
              <span className="flex h-4 items-center justify-center gap-2">
                <Check className="size-3.5" />
                Joined
              </span>
            </span>
          </span>
        </button>

        <p className="text-[11px] leading-relaxed text-black/45 dark:text-white/40">
          GitHub stays the source of truth. This is the layer around it.
        </p>
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
