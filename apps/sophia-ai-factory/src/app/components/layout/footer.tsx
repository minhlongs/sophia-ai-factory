import { Container } from "@/components/ui/container";
import { useTranslations } from "next-intl";
import Link from "next/link";

export function Footer() {
  const t = useTranslations('landing');
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 border-t border-border bg-background text-foreground">
      <Container>
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-purple)] bg-clip-text text-transparent mb-4">
              {t('footer.brand')}
            </h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              {t('footer.description')}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">{t('footer.product')}</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/#pricing" className="text-muted-foreground hover:text-[var(--neon-cyan)] transition-colors text-sm">
                  {t('footer.links.pricing')}
                </Link>
              </li>
              <li>
                <Link href="/#features" className="text-muted-foreground hover:text-[var(--neon-cyan)] transition-colors text-sm">
                  {t('footer.links.features')}
                </Link>
              </li>
              <li>
                <Link href="/affiliate-discovery" className="text-muted-foreground hover:text-[var(--neon-cyan)] transition-colors text-sm">
                  {t('footer.links.affiliates')}
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="text-muted-foreground hover:text-[var(--neon-cyan)] transition-colors text-sm">
                  {t('footer.links.faq')}
                </Link>
              </li>
              {/* <li>
                <Link href="#" className="text-muted-foreground hover:text-[var(--neon-cyan)] transition-colors text-sm">
                  Documentation
                </Link>
              </li> */}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">{t('footer.company')}</h4>
            <ul className="space-y-2">
              {/* <li>
                <Link href="#" className="text-muted-foreground hover:text-[var(--neon-cyan)] transition-colors text-sm">
                  About
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-[var(--neon-cyan)] transition-colors text-sm">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-[var(--neon-cyan)] transition-colors text-sm">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-[var(--neon-cyan)] transition-colors text-sm">
                  Support
                </Link>
              </li> */}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            {t('footer.copyright', { year: currentYear })}
          </p>
          <p className="text-muted-foreground text-sm">
            {t('footer.made_by')}{" "}
            <span className="text-[var(--neon-cyan)]">Mekong CLI</span>
          </p>
        </div>
      </Container>
    </footer>
  );
}
