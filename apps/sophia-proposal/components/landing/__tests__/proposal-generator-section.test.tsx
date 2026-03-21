import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProposalGeneratorSection } from "../proposal-generator-section";

describe("ProposalGeneratorSection", () => {
  it("renders the section heading", () => {
    render(<ProposalGeneratorSection />);

    const heading = screen.getByRole("heading", {
      name: /ai proposal generator/i,
    });
    expect(heading).toBeInTheDocument();
  });

  it("renders the section description", () => {
    render(<ProposalGeneratorSection />);

    const description = screen.getByText(
      /create winning proposals faster with ai assistance/i
    );
    expect(description).toBeInTheDocument();
  });

  it("renders all three feature cards", () => {
    render(<ProposalGeneratorSection />);

    expect(screen.getByText(/automated proposal writing/i)).toBeInTheDocument();
    expect(screen.getByText(/ai-powered insights/i)).toBeInTheDocument();
    expect(screen.getByText(/custom templates/i)).toBeInTheDocument();
  });

  it("renders feature descriptions", () => {
    render(<ProposalGeneratorSection />);

    expect(
      screen.getByText(
        /generate professional proposals in minutes/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/get intelligent recommendations on pricing/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/choose from industry-specific templates/i)
    ).toBeInTheDocument();
  });

  it("uses correct visual hierarchy", () => {
    const { container } = render(<ProposalGeneratorSection />);

    const section = container.querySelector("section");
    expect(section).toHaveClass("py-20");
    expect(section).toHaveClass("bg-surface-container-low");
  });
});
