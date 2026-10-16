import { createFileRoute } from "@tanstack/react-router";
import { RhythmRuts } from "@/components/rhythm-ruts";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <RhythmRuts />;
}
