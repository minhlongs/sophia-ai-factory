"use client";

import { useMemo } from "react";

export type DocumentGroup = {
  label: string;
  icon: string;
  docs: { name: string; description: string; path: string; access: "restricted" | "nda" | "public" }[];
};

type AccessBadgeProps = {
  access: "restricted" | "nda" | "public";
};

function AccessBadge({ access }: AccessBadgeProps) {
  const styles: Record<string, string> = {
    restricted: "border-red-200 bg-red-50 text-red-700",
    nda: "border-amber-200 bg-amber-50 text-amber-700",
    public: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  const labels: Record<string, string> = {
    restricted: "Restricted",
    nda: "NDA Required",
    public: "Public",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[access] || styles.public}`}>
      {labels[access] || access}
    </span>
  );
}

export function DocumentSection({ group }: { group: DocumentGroup }) {
  const docs = useMemo(() => group.docs, [group]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-2xl">{group.icon}</span>
        <h2 className="text-xl font-semibold text-muted-foreground-900">{group.label}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {docs.map((doc) => (
          <a
            key={doc.path + doc.name}
            href={doc.path}
            className="group rounded-xl border border-border-200 bg-white p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground-900">{doc.name}</h3>
              <AccessBadge access={doc.access} />
            </div>
            <p className="mb-3 text-xs text-muted-foreground-600">{doc.description}</p>
            <span className="inline-flex items-center text-xs font-medium text-primary group-hover:text-primary">
              Download PDF →
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
