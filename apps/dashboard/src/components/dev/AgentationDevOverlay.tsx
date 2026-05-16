"use client";

import { Agentation } from "agentation";

const endpoint = process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT;

export function AgentationDevOverlay() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <Agentation
      endpoint={endpoint}
      onSessionCreated={(sessionId) => {
        console.info("Agentation session started:", sessionId);
      }}
    />
  );
}
