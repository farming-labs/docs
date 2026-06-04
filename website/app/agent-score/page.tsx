import type { Metadata } from "next";
import { AgentScorePage } from "./agent-score-page";

export const metadata: Metadata = {
  title: "Agent Score",
  description:
    "Score the agent-readiness of any documentation site. The same checks that ship in `docs doctor --agent --url` from @farming-labs/docs, runnable from the browser, with an opt-in leaderboard.",
  openGraph: {
    title: "Agent Score – @farming-labs/docs",
    description:
      "Score the agent-readiness of any documentation site and compare against the community leaderboard.",
  },
};

export default function Page() {
  return <AgentScorePage />;
}
