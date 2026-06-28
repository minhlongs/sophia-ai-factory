import Link from "next/link";

interface Props {
  href: string;
  label: string;
}

export function DistributeButton({ href, label }: Props) {
  return (
    <Link
      href={href}
      className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 min-h-[44px] inline-flex items-center gap-2"
    >
      <span aria-hidden="true">&#8599;</span>
      {label}
    </Link>
  );
}
