import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup - Sophia AI Factory",
  description: "Configure your AI Factory settings.",
};

export default function SetupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* No Navbar here - specialized layout for setup */}
      {children}
    </div>
  );
}
