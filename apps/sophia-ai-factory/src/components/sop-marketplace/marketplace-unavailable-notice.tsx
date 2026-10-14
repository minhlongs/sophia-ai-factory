/** Bilingual status shown while Creator Marketplace V2 is contained. */
export function MarketplaceUnavailableNotice() {
  return (
    <section
      role="status"
      aria-live="polite"
      className="mx-auto max-w-3xl rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <h1 className="text-lg font-semibold">
        Creator Marketplace tạm thời bảo trì / temporarily unavailable
      </h1>
      <p className="mt-2 text-sm leading-6">
        Chúng tôi đang đối soát tính toàn vẹn dữ liệu. Vui lòng quay lại sau.
        <br />
        We are reconciling database integrity. Please check back later.
      </p>
    </section>
  );
}
