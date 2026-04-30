/**
 * Tests for SignupForm component.
 * Covers: rendering, client-side validation, successful signup redirect,
 * error states (email exists, generic), loading state.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { SignupForm } from "./signup-form";

// ── Hoist mocks so factories can reference them safely ──────────────────────

const { mockPush, mockRefresh, mockSignUpEmail } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockSignUpEmail: vi.fn(),
}));

// ── Mock next/navigation ────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

// ── Mock better-auth-client ─────────────────────────────────────────────────

vi.mock("@/lib/better-auth-client", () => ({
  authClient: {
    signUp: { email: mockSignUpEmail },
  },
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

const T = {
  name_label: "Full Name",
  name_placeholder: "Your name",
  email_label: "Email",
  email_placeholder: "you@example.com",
  password_label: "Password",
  password_placeholder: "Min 8 characters",
  confirm_label: "Confirm Password",
  confirm_placeholder: "Re-enter password",
  submit: "Create Account",
  submitting: "Creating account...",
  success_title: "Account Created!",
  success_message: "Redirecting to setup wizard...",
  error_password_mismatch: "Passwords do not match",
  error_password_too_short: "Password must be at least 8 characters",
  error_email_exists: "This email is already registered. Try signing in.",
  error_generic: "Signup failed. Please try again.",
  have_account: "Already have an account?",
} as const;

function fillForm({
  name = "Test User",
  email = "test@example.com",
  password = "password123",
  confirm = "password123",
}: {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
} = {}) {
  fireEvent.change(screen.getByLabelText(T.name_label), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(T.email_label), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(T.password_label), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(T.confirm_label), { target: { value: confirm } });
}

// ── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockSignUpEmail.mockResolvedValue({ error: null });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("SignupForm", () => {
  it("renders all form fields and submit button", () => {
    render(<SignupForm t={T} />);

    expect(screen.getByLabelText(T.name_label)).toBeDefined();
    expect(screen.getByLabelText(T.email_label)).toBeDefined();
    expect(screen.getByLabelText(T.password_label)).toBeDefined();
    expect(screen.getByLabelText(T.confirm_label)).toBeDefined();
    expect(screen.getByRole("button", { name: T.submit })).toBeDefined();
  });

  it("shows error when password is too short", async () => {
    render(<SignupForm t={T} />);
    fillForm({ password: "short", confirm: "short" });

    await act(async () => {
      fireEvent.submit(screen.getByTestId("signup-form"));
    });

    expect(screen.getByRole("alert").textContent).toBe(T.error_password_too_short);
    expect(mockSignUpEmail).not.toHaveBeenCalled();
  });

  it("shows error when passwords do not match", async () => {
    render(<SignupForm t={T} />);
    fillForm({ password: "password123", confirm: "different456" });

    await act(async () => {
      fireEvent.submit(screen.getByTestId("signup-form"));
    });

    expect(screen.getByRole("alert").textContent).toBe(T.error_password_mismatch);
    expect(mockSignUpEmail).not.toHaveBeenCalled();
  });

  it("calls authClient.signUp.email with correct args on valid submit", async () => {
    render(<SignupForm t={T} />);
    fillForm();

    await act(async () => {
      fireEvent.submit(screen.getByTestId("signup-form"));
      await vi.runAllTimersAsync();
    });

    expect(mockSignUpEmail).toHaveBeenCalledWith({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
      callbackURL: "/setup-wizard",
    });
  });

  it("shows success state after successful signup", async () => {
    render(<SignupForm t={T} />);
    fillForm();

    await act(async () => {
      fireEvent.submit(screen.getByTestId("signup-form"));
      await vi.runAllTimersAsync();
    });

    expect(screen.getByTestId("signup-success")).toBeDefined();
    expect(screen.getByText(T.success_title)).toBeDefined();
  });

  it("redirects to /setup-wizard after 1200ms on success", async () => {
    render(<SignupForm t={T} />);
    fillForm();

    await act(async () => {
      fireEvent.submit(screen.getByTestId("signup-form"));
      await vi.runAllTimersAsync();
    });

    // Advance past the 1200ms timeout
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(mockPush).toHaveBeenCalledWith("/setup-wizard");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows email-exists error when auth returns 'already' in message", async () => {
    mockSignUpEmail.mockResolvedValueOnce({
      error: { message: "User already exists" },
    });

    render(<SignupForm t={T} />);
    fillForm();

    await act(async () => {
      fireEvent.submit(screen.getByTestId("signup-form"));
      await vi.runAllTimersAsync();
    });

    expect(screen.getByRole("alert").textContent).toBe(T.error_email_exists);
  });

  it("shows generic error on unexpected auth failure", async () => {
    mockSignUpEmail.mockResolvedValueOnce({
      error: { message: "Internal server error" },
    });

    render(<SignupForm t={T} />);
    fillForm();

    await act(async () => {
      fireEvent.submit(screen.getByTestId("signup-form"));
      await vi.runAllTimersAsync();
    });

    expect(screen.getByRole("alert").textContent).toBe("Internal server error");
  });

  it("shows generic error when signUp throws", async () => {
    mockSignUpEmail.mockRejectedValueOnce(new Error("Network error"));

    render(<SignupForm t={T} />);
    fillForm();

    await act(async () => {
      fireEvent.submit(screen.getByTestId("signup-form"));
      await vi.runAllTimersAsync();
    });

    expect(screen.getByRole("alert").textContent).toBe(T.error_generic);
  });

  it("disables submit button while loading", async () => {
    // Never resolve — keep loading state
    mockSignUpEmail.mockReturnValue(new Promise(() => {}));

    render(<SignupForm t={T} />);
    fillForm();

    await act(async () => {
      fireEvent.submit(screen.getByTestId("signup-form"));
    });

    const btn = screen.getByRole("button", { name: /creating account/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
