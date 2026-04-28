import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoCreatorWizard } from "./video-creator-wizard";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "steps.script": "Script",
      "steps.assets": "Assets",
      "steps.render": "Render",
      "script.topic": "Topic",
      "script.audience": "Audience",
      "script.duration": "Duration (seconds)",
      "script.placeholderTopic": "e.g. AI productivity tools",
      "script.placeholderAudience": "e.g. solo founders & marketers",
      "script.generate": "Generate Script",
      "script.regenerate": "Regenerate",
      "script.useScript": "Use This Script →",
      "script.hook": "Hook",
      "script.body": "Body",
      "script.cta": "CTA",
      "actions.back": "Back",
      "actions.create": "Create Video",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: React.ComponentProps<"label">) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock("lucide-react", () => ({
  Loader2: () => <div data-testid="loader" />,
}));

describe("VideoCreatorWizard", () => {
  it("renders the script step initially with topic and audience inputs", () => {
    render(<VideoCreatorWizard />);
    expect(screen.getByLabelText(/topic/i)).toBeDefined();
    expect(screen.getByLabelText(/audience/i)).toBeDefined();
    expect(screen.getByLabelText(/duration/i)).toBeDefined();
    expect(screen.getByText(/generate script/i)).toBeDefined();
  });

  it("shows progress indicator with all three steps", () => {
    render(<VideoCreatorWizard />);
    expect(screen.getByText(/1\. Script/i)).toBeDefined();
    expect(screen.getByText(/2\. Assets/i)).toBeDefined();
    expect(screen.getByText(/3\. Render/i)).toBeDefined();
  });
});
