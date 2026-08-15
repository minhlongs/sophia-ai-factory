export const dynamic = 'force-dynamic';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-6">
          Liên Hệ / Contact
        </h1>
        <p className="text-muted-foreground mb-4">
          Sophia AI Factory — Hỗ trợ khách hàng.
        </p>
        <p className="text-muted-foreground text-sm">
          Email: support@mekongmind.com
        </p>
      </div>
    </main>
  );
}
