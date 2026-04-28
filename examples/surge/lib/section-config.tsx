import {
  Blocks,
  BookOpen,
  Compass,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  Terminal,
  Waypoints,
} from "lucide-react";
import { defineDocs, type DocsConfig, type OrderingItem } from "@farming-labs/docs";
import { greentree } from "@farming-labs/theme/greentree";
import { CodeGroup, MdxLink, Step, Steps, Warning } from "@/app/components/mdx-widgets";
import { BrandMark, SectionLinks, SidebarFooter } from "@/app/components/surge-brand";

const sectionTheme = greentree({
  ui: {
    colors: {
      primary: "#8200ff",
      primaryForeground: "#ffffff",
      accent: "#f4ecff",
      accentForeground: "#4c1d95",
    },
    layout: {
      sidebarWidth: 308,
      contentWidth: 900,
      tocWidth: 260,
      toc: {
        enabled: true,
        depth: 3,
      },
    },
    typography: {
      font: {
        style: {
          sans: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
          mono: "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
        },
      },
    },
    sidebar: {
      style: "floating",
    },
  },
});

const sharedConfig: Omit<DocsConfig, "entry" | "ordering" | "sidebar"> = {
  theme: sectionTheme,
  nav: {
    title: <BrandMark compact linked={false} />,
    url: "/",
  },
  metadata: {
    titleTemplate: "%s | Surge",
    description: "Developer documentation for Surge APIs, webhooks, and embedded UI components.",
  },
  themeToggle: {
    enabled: true,
  },
  breadcrumb: {
    enabled: true,
  },
  search: false,
  feedback: false,
  ai: {
    enabled: false,
  },
  github: {
    url: "https://github.com/maniculehq/surge-docs",
  },
  components: {
    CodeGroup,
    Link: MdxLink,
    Step,
    Steps,
    Warning,
  },
  icons: {
    terminal: <Terminal size={16} />,
    compass: <Compass size={16} />,
    cubes: <Blocks size={16} />,
    book: <BookOpen size={16} />,
    scroll: <ScrollText size={16} />,
    webhook: <Waypoints size={16} />,
    shield: <ShieldCheck size={16} />,
    message: <MessageSquare size={16} />,
  },
};

const apiReferenceOrdering: OrderingItem[] = [
  { slug: "introduction" },
  {
    slug: "endpoint",
    children: [
      {
        slug: "accounts",
        children: [
          { slug: "create" },
          { slug: "check-status" },
          { slug: "update" },
          { slug: "archive" },
        ],
      },
      {
        slug: "audiences",
        children: [{ slug: "create" }, { slug: "add_contact" }, { slug: "list_contacts" }],
      },
      {
        slug: "blasts",
        children: [{ slug: "create" }],
      },
      {
        slug: "campaigns",
        children: [{ slug: "create" }, { slug: "list" }, { slug: "get" }, { slug: "update" }],
      },
      {
        slug: "contacts",
        children: [{ slug: "list" }, { slug: "create" }, { slug: "get" }, { slug: "update" }],
      },
      {
        slug: "messages",
        children: [{ slug: "list" }, { slug: "create" }, { slug: "get" }],
      },
      {
        slug: "phone-numbers",
        children: [{ slug: "list" }, { slug: "purchase" }],
      },
      {
        slug: "recordings",
        children: [{ slug: "list" }, { slug: "get" }, { slug: "delete" }, { slug: "get_file" }],
      },
      {
        slug: "users",
        children: [
          { slug: "create" },
          { slug: "list" },
          { slug: "get" },
          { slug: "update" },
          { slug: "delete" },
          { slug: "create-token" },
        ],
      },
      {
        slug: "verifications",
        children: [{ slug: "create" }, { slug: "check" }],
      },
    ],
  },
  {
    slug: "webhooks",
    children: [
      { slug: "intro" },
      { slug: "signature-validation" },
      { slug: "call", children: [{ slug: "ended" }] },
      { slug: "campaign", children: [{ slug: "approved" }] },
      { slug: "contact", children: [{ slug: "opted_in" }, { slug: "opted_out" }] },
      { slug: "conversation", children: [{ slug: "created" }] },
      { slug: "link", children: [{ slug: "followed" }] },
      {
        slug: "message",
        children: [
          { slug: "delivered" },
          { slug: "failed" },
          { slug: "received" },
          { slug: "sent" },
        ],
      },
      { slug: "phone_number", children: [{ slug: "attached_to_campaign" }] },
      { slug: "recording", children: [{ slug: "completed" }] },
      { slug: "voicemail", children: [{ slug: "received" }] },
    ],
  },
];

const guidesOrdering: OrderingItem[] = [
  {
    slug: "carrier-registration",
    children: [{ slug: "register-a-campaign" }],
  },
];

const uiOrdering: OrderingItem[] = [
  { slug: "introduction" },
  { slug: "authentication" },
  {
    slug: "components",
    children: [{ slug: "inbox" }, { slug: "conversation" }, { slug: "unread-count" }],
  },
];

function createSectionConfig(
  entry: string,
  currentSection: "api-reference" | "guides" | "ui",
  ordering: OrderingItem[],
): DocsConfig {
  return defineDocs({
    ...sharedConfig,
    entry,
    ordering,
    sidebar: {
      banner: <SectionLinks current={currentSection} />,
      footer: <SidebarFooter />,
    },
  });
}

export const apiReferenceConfig = createSectionConfig(
  "api-reference",
  "api-reference",
  apiReferenceOrdering,
);
export const guidesConfig = createSectionConfig("guides", "guides", guidesOrdering);
export const uiConfig = createSectionConfig("ui", "ui", uiOrdering);
