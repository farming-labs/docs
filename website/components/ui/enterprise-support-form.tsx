"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Loader2 } from "lucide-react";
import PixelCard from "@/components/ui/pixel-card";

const supportOptions = [
  { value: "infrastructure", label: "Infrastructure support" },
  { value: "cloud", label: "Docs Cloud setup" },
  { value: "branding", label: "Custom branding" },
  { value: "agent-human", label: "Agent + human optimization" },
  { value: "migration", label: "Migration support" },
  { value: "private-docs", label: "Private docs workflows" },
] as const;

const teamSizeOptions = ["1-10", "10-30", "30-50", "50-100", "100+"] as const;

type SubmitState =
  | { status: "idle"; message: null }
  | { status: "success"; message: string }
  | { status: "warning"; message: string }
  | { status: "error"; message: string };

type ButtonMode = "idle" | "loading" | "success";

export function EnterpriseSupportForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [supportNeeds, setSupportNeeds] = useState<string[]>(["infrastructure"]);
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
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  function toggleSupportNeed(value: string) {
    setSupportNeeds((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      return [...current, value];
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (buttonMode === "success") return;

    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }

    setLoading(true);
    setButtonMode("loading");
    setSubmitState({ status: "idle", message: null });

    try {
      const response = await fetch("/api/enterprise-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company,
          role,
          teamSize,
          websiteUrl,
          supportNeeds,
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
          message: payload.error || "Support request failed. Please try again.",
        });
        return;
      }

      setName("");
      setEmail("");
      setCompany("");
      setRole("");
      setTeamSize("");
      setWebsiteUrl("");
      setSupportNeeds(["infrastructure"]);
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
        message: "Request received. We’ll get back to you fast with the right next step.",
      });

      successTimeoutRef.current = setTimeout(() => {
        setButtonMode("idle");
      }, 5000);
    } catch {
      setButtonMode("idle");
      setSubmitState({
        status: "error",
        message: "Request failed before it reached support. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PixelCard className="border-black/10 bg-white/95 p-0 dark:border-white/10 dark:bg-black/35">
      <div className="border-b border-black/10 px-5 py-4 dark:border-white/10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
          Enterprise support
        </p>
        <h2 className="mt-2 font-pixel text-xl font-normal tracking-normal text-black dark:text-white">
          Tell us what you need.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-black/55 dark:text-white/45">
          Infrastructure, cloud setup, branding, private docs, and agent-ready docs support.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="enterprise-support-name"
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Mekonnen"
          />
          <Field
            id="enterprise-support-company"
            label="Company"
            value={company}
            onChange={setCompany}
            placeholder="Acme"
            required
          />
        </div>

        <Field
          id="enterprise-support-email"
          label="Work email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="team@company.com"
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="enterprise-support-role"
            label="Role"
            value={role}
            onChange={setRole}
            placeholder="Head of engineering"
          />
          <SingleSelectDropdown
            id="enterprise-support-team-size"
            label="Team size"
            value={teamSize}
            onChange={setTeamSize}
            placeholder="Select range"
            options={teamSizeOptions}
          />
        </div>

        <Field
          id="enterprise-support-website-url"
          label="Website URL"
          type="url"
          value={websiteUrl}
          onChange={setWebsiteUrl}
          placeholder="https://company.com"
        />

        <SupportNeedList value={supportNeeds} onToggle={toggleSupportNeed} />

        <div>
          <label
            htmlFor="enterprise-support-message"
            className="mb-1 block font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45"
          >
            What should we know?
          </label>
          <textarea
            id="enterprise-support-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tell us what is blocked, what stack you run, what kind of support you need, and when you want to launch."
            rows={5}
            className="w-full resize-none rounded-none border border-black/10 bg-transparent px-3 py-2 text-sm leading-relaxed text-black outline-none transition-colors focus:border-black/30 dark:border-white/10 dark:text-white dark:focus:border-white/25"
          />
        </div>

        <button
          type="submit"
          disabled={loading || buttonMode === "success"}
          className="group inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-4 py-3 font-mono text-[11px] uppercase tracking-wide text-white transition-all hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
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
                Contact support
                <ArrowRight className="size-3.5 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
              </span>
              <span className="flex h-4 items-center justify-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                Sending
              </span>
              <span className="flex h-4 items-center justify-center gap-2">
                <Check className="size-3.5" />
                Sent
              </span>
            </span>
          </span>
        </button>

        {submitState.message ? (
          <p
            className={[
              "border px-3 py-2 text-[11px] leading-relaxed",
              submitState.status === "success"
                ? "border-black/15 bg-black/[0.03] text-black/60 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/60"
                : submitState.status === "warning"
                  ? "border-black/12 bg-black/[0.02] text-black/55 dark:border-white/12 dark:bg-white/[0.03] dark:text-white/55"
                  : "border-black/12 bg-black/[0.015] text-black/55 dark:border-white/12 dark:bg-white/[0.02] dark:text-white/55",
            ].join(" ")}
          >
            {submitState.message}
          </p>
        ) : null}

        <p className="text-[11px] leading-relaxed text-black/45 dark:text-white/40">
          We prioritize infrastructure and launch-blocking requests from teams moving docs into
          production.
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
  type = "text",
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "email" | "text" | "url";
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-none border border-black/10 bg-transparent px-3 py-2.5 text-sm text-black outline-none transition-colors placeholder:text-black/25 focus:border-black/30 dark:border-white/10 dark:text-white dark:placeholder:text-white/25 dark:focus:border-white/25"
      />
    </div>
  );
}

function SingleSelectDropdown({
  id,
  label,
  value,
  onChange,
  placeholder,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="min-w-0 space-y-1">
      <label className="block font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
        {label}
      </label>
      <div className="relative">
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full touch-manipulation items-center justify-between gap-3 border border-black/10 bg-transparent px-3 py-2.5 text-left text-sm text-black outline-none transition-colors hover:border-black/20 focus:border-black/30 dark:border-white/10 dark:text-white dark:hover:border-white/20 dark:focus:border-white/25"
        >
          <span
            className={value ? "text-black dark:text-white" : "text-black/25 dark:text-white/25"}
          >
            {value || placeholder}
          </span>
          <ChevronDown
            className={[
              "size-3.5 shrink-0 text-black/35 transition-transform dark:text-white/35",
              open ? "rotate-180" : "",
            ].join(" ")}
            strokeWidth={1.8}
          />
        </button>

        {open ? (
          <div className="relative z-30 mt-2 border border-black/10 bg-white shadow-[0_16px_40px_rgba(0,0,0,0.08)] sm:absolute sm:left-0 sm:right-0 sm:top-[calc(100%+0.4rem)] sm:mt-0 dark:border-white/10 dark:bg-black">
            <div
              role="listbox"
              aria-label={label}
              className="max-h-72 overflow-y-auto overscroll-contain p-1.5"
            >
              {options.map((option, index) => {
                const selected = value === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                    className={[
                      "flex w-full touch-manipulation items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "bg-black/[0.04] dark:bg-white/[0.06]"
                        : "hover:bg-black/[0.025] dark:hover:bg-white/[0.04]",
                    ].join(" ")}
                  >
                    <span className="min-w-0 text-sm leading-snug text-black dark:text-white">
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-black/40 dark:text-white/40">
                        {String(index + 1).padStart(2, "0")}.
                      </span>{" "}
                      {option}
                    </span>
                    <span
                      className={[
                        "flex size-5 shrink-0 items-center justify-center border transition-colors",
                        selected
                          ? "border-black/20 bg-black text-white dark:border-white/20 dark:bg-white dark:text-black"
                          : "border-black/10 text-transparent dark:border-white/10",
                      ].join(" ")}
                    >
                      <Check className="size-3" strokeWidth={2} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SupportNeedList({
  value,
  onToggle,
}: {
  value: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
        Support needed
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {supportOptions.map((option, index) => {
          const selected = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              aria-pressed={selected}
              className={[
                "flex min-h-11 items-center gap-2 border px-3 py-2 text-left text-[12px] leading-tight transition-colors",
                selected
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-black/10 bg-black/[0.015] text-black/60 hover:border-black/20 dark:border-white/10 dark:bg-white/[0.015] dark:text-white/55 dark:hover:border-white/20",
              ].join(" ")}
            >
              <span
                className={[
                  "shrink-0 font-mono text-[10px] uppercase tracking-[0.16em]",
                  selected
                    ? "text-white/70 dark:text-black/60"
                    : "text-black/35 dark:text-white/35",
                ].join(" ")}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
