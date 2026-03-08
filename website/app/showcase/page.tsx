"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { LayoutGrid, ExternalLink, Plus, Loader2, ArrowRight, Check } from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-bg-black";

type ShowcaseEntry = {
  id: string;
  name: string;
  url: string;
  description: string | null;
  screenshot: string | null;
  createdAt: string;
};

function withShowcaseUtm(url: string) {
  try {
    const u = new URL(url);
    const params = u.searchParams;
    if (!params.has("utm_source")) params.set("utm_source", "docs.farming-labs.dev");
    if (!params.has("utm_medium")) params.set("utm_medium", "referral");
    if (!params.has("utm_campaign")) params.set("utm_campaign", "showcase");
    return u.toString();
  } catch {
    return url;
  }
}

export default function ShowcasePage() {
  const [entries, setEntries] = useState<ShowcaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formScreenshot, setFormScreenshot] = useState("");
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/showcase");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setEntries(data);
    } catch (e) {
      console.error(e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitLoading(true);
    try {
      const res = await fetch("/api/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          url: formUrl.trim(),
          description: formDescription.trim() || undefined,
          screenshot: formScreenshot.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Something went wrong");
        return;
      }
      setFormName("");
      setFormUrl("");
      setFormDescription("");
      setFormScreenshot("");
      setScreenshotError(null);
      fileInputRef.current && (fileInputRef.current.value = "");
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 5000);
      fetchEntries();
    } catch (err) {
      setSubmitError("Failed to submit. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  }

  const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024; // 2MB

  function handleScreenshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setScreenshotError(null);
    if (!f.type.startsWith("image/")) {
      setScreenshotError("Please select an image (JPEG, PNG, WebP, or GIF).");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_SCREENSHOT_BYTES) {
      setScreenshotError("Image must be under 2MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === "string") setFormScreenshot(dataUrl);
    };
    reader.onerror = () => setScreenshotError("Failed to read image.");
    reader.readAsDataURL(f);
    // Don't clear e.target.value so the input keeps showing the selected file name
  }

  return (
    <div
      className="min-h-dvh relative bg-white text-neutral-900 dark:bg-black dark:text-white"
      style={{ fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}
    >
      <div className="absolute w-full top-14 right-0 z-[999] h-px bg-neutral-200 dark:bg-white/[8%]" />
      <div className="pointer-events-none fixed inset-0 z-[999] hidden lg:block">
        <div className="mx-auto md:max-w-[90%] max-w-full h-full relative">
          <div className="absolute left-0 top-0 h-full w-px bg-neutral-200 dark:bg-white/[8%]" />
          <div className="absolute right-0 top-0 h-full w-px bg-neutral-200 dark:bg-white/[8%]" />
        </div>
      </div>

      <header className="px-6 py-0">
        <div className="mx-auto md:max-w-[90%] max-w-full flex items-center justify-between">
          <div>
            <div className="flex pt-5 items-center gap-2 text-xs font-medium text-neutral-600 dark:text-white/80 pb-8 md:pb-0">
              <Link
                href="/"
                className="hover:text-neutral-900 dark:hover:text-white transition-colors hover:no-underline font-mono uppercase text-neutral-500 dark:text-white/50"
              >
                Home <span className="ml-2 text-neutral-400 dark:text-white/50">/</span>
              </Link>
              <LayoutGrid className="size-3.5" strokeWidth={2} />
              <p className="font-mono uppercase">Showcase</p>
            </div>
          </div>
        </div>
      </header>

      <main className="overflow-x-hidden mx-auto max-w-[90%] w-full md:px-6 py-5 pb-0">
        <div className="flex flex-col lg:flex-row lg:gap-10 xl:gap-12">
          <div className="min-w-0 flex-1 relative">
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none hidden sm:block opacity-[0.5] -mr-12"
              aria-hidden
            >
              <AnimatedBackground />
            </div>
            <div className="relative z-10 mb-6 sm:pt-14 max-w-2xl">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900 dark:text-white mb-2">
                Showcase
              </h1>
              <p className="text-[13px] text-neutral-500 dark:text-white/40 leading-relaxed">
                Documentation sites built with{" "}
                <code className="font-mono text-neutral-900 dark:text-white">
                  @farming-labs/docs
                </code>
                .{" "}
              </p>
              <p className="text-[13px] text-neutral-500 dark:text-white/40 leading-relaxed">
                <span className="lg:hidden">Submit yours below.</span>
                <span className="hidden lg:inline">
                  Submit yours to see your documentation site here.
                </span>
              </p>
            </div>
          </div>
          <div className="mt-8 relative pb-0 lg:mt-0 lg:pt-0 lg:w-[340px] lg:shrink-0 lg:border-l border-neutral-200 dark:border-white/10 lg:pl-6">
            <div className="absolute z-[999] left-0 sm:left-6 top-4 sm:top-0 w-px h-[95%] sm:h-full bg-neutral-200 dark:bg-white/10" />
            <div className="absolute z-[999] right-0 top-8 sm:top-0 w-px h-[95%] sm:h-full bg-neutral-200 dark:bg-white/10" />
            <div className="lg:sticky lg:top-24 mt-4">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label
                    htmlFor="showcase-name"
                    className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 dark:text-white/50 mb-0.5"
                  >
                    Name
                  </label>
                  <input
                    id="showcase-name"
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My Project Docs"
                    required
                    className="w-full rounded-none border border-l-0 border-r-0 border-neutral-200 dark:border-white/10 bg-white dark:bg-black/50 px-2.5 py-1.5 text-xs font-mono text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-white/30"
                  />
                </div>
                <div>
                  <label
                    htmlFor="showcase-url"
                    className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 dark:text-white/50 mb-0.5"
                  >
                    URL
                  </label>
                  <input
                    id="showcase-url"
                    type="url"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://docs.example.com"
                    required
                    className="w-full rounded-none border border-l-0 border-r-0 border-neutral-200 dark:border-white/10 bg-white dark:bg-black/50 px-2.5 py-1.5 text-xs font-mono text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-white/30"
                  />
                </div>
                <div>
                  <label
                    htmlFor="showcase-desc"
                    className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 dark:text-white/50 mb-0.5"
                  >
                    Description <span className="normal-case font-normal">(opt.)</span>
                  </label>
                  <input
                    id="showcase-desc"
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Short description"
                    className="w-full rounded-none border border-l-0 border-r-0 border-neutral-200 dark:border-white/10 bg-white dark:bg-black/50 px-2.5 py-1.5 text-xs font-mono text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-white/30"
                  />
                </div>
                <div>
                  <label
                    htmlFor="showcase-screenshot"
                    className="block text-[10px] font-mono uppercase tracking-wider text-neutral-500 dark:text-white/50 mb-0.5"
                  >
                    Screenshot <span className="normal-case font-normal">(opt.)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    id="showcase-screenshot"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleScreenshotChange}
                    className="w-full text-[11px] font-mono text-neutral-700 dark:text-white/60 file:mr-2 file:rounded-none file:border file:border-neutral-200 file:bg-neutral-100 dark:file:border-white/10 dark:file:bg-white/5 file:px-2 file:py-1 file:text-xs file:text-neutral-700 dark:file:text-white/80"
                  />
                  {screenshotError && (
                    <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400">
                      {screenshotError}
                    </p>
                  )}
                </div>
                {submitError && (
                  <p className="text-[10px] text-red-600 dark:text-red-400">{submitError}</p>
                )}
                <div className="h-px w-full bg-neutral-200 dark:bg-white/8" />
                <div className="flex -mt-3 items-end justify-end gap-1.5">
                  <button
                    type="submit"
                    disabled={submitLoading || submitSuccess}
                    className="flex gap-1.5 rounded-none border border-neutral-300 dark:border-white/10 bg-neutral-900 dark:bg-white text-white dark:text-black px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider hover:bg-neutral-800 dark:hover:bg-white/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {submitLoading ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : submitSuccess ? (
                      <Check className="size-3" />
                    ) : (
                      <Plus className="size-3" />
                    )}
                    {submitLoading ? "Submit" : submitSuccess ? "Submitted" : "Submit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="h-px w-[calc(100%+200px)] ml-0 sm:-ml-[100px] mx-auto bg-neutral-200 dark:bg-white/8 mt-0" />
        <div className="mt-10 relative">
          <div className="relative z-10">
            <h2 className="text-[11px] font-mono uppercase tracking-wider text-neutral-700 dark:text-white/70 mb-3">
              Sites
            </h2>
            {loading ? (
              <div className="flex items-center gap-2 text-neutral-500 dark:text-white/50 text-xs font-mono">
                <Loader2 className="size-3.5 animate-spin" />
                Loading…
              </div>
            ) : entries.length === 0 ? (
              <p className="text-xs text-neutral-500 dark:text-white/50">
                No entries yet. Be the first to submit!
              </p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {entries.map((entry) => {
                  const trackedUrl = withShowcaseUtm(entry.url);
                  return (
                    <li key={entry.id}>
                      <a
                        href={trackedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block rounded-none border border-neutral-200 dark:border-white/8 bg-black/[0.02] dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/12 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors overflow-hidden"
                      >
                        <div className="aspect-[16/10] w-full overflow-hidden border-b border-neutral-200 dark:border-white/8 bg-neutral-100 dark:bg-white/5">
                          {entry.screenshot ? (
                            <img
                              src={entry.screenshot}
                              alt=""
                              className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-300 dark:text-white/20">
                              <span className="text-[10px] font-mono uppercase">No preview</span>
                            </div>
                          )}
                        </div>
                        <div className="p-3 px-4 relative pb-0 flex flex-col gap-1">
                          <div className="absolute left-4 top-0 w-px h-full bg-neutral-200 dark:bg-white/8" />
                          <div className="absolute right-4 top-0 w-px h-full bg-neutral-200 dark:bg-white/8" />
                          <span className="font-mono text-xs font-medium text-neutral-900 dark:text-white group-hover:underline truncate">
                            {entry.name}
                          </span>
                          {entry.description && (
                            <span className="text-[12px] text-neutral-500 dark:text-white/50 line-clamp-2">
                              {entry.description}
                            </span>
                          )}
                          <div className="flex items-end justify-end">
                            <a
                              href={trackedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cursor-pointer group"
                            >
                              <button className="text-[10px] cursor-pointer font-mono rounded-none border border-neutral-300 flex items-center gap-1 dark:border-white/10 bg-neutral-900 dark:bg-white text-white dark:text-black px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider hover:bg-neutral-800 dark:hover:bg-white/90 transition-colors disabled:opacity-50 disabled:pointer-events-none">
                                Check it out
                                <ArrowRight className="size-3.5 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                              </button>
                            </a>
                          </div>
                        </div>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
