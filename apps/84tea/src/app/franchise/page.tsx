import { FranchiseHero } from "@/components/franchise/franchise-hero";
import { FranchiseBenefits } from "@/components/franchise/franchise-benefits";
import { FranchiseModels } from "@/components/franchise/franchise-models";
import { FranchiseProcess } from "@/components/franchise/franchise-process";
import { FranchiseForm } from "@/components/franchise/franchise-form";
import { MainLayout } from "@/components/layout/main-layout";
import { FooterSection } from "@/components/layout/footer-section";

export const metadata = {
  title: "Nhượng quyền | 84tea - Di sản trà Việt",
  description: "Cơ hội hợp tác kinh doanh bền vững cùng 84tea. Mô hình nhượng quyền linh hoạt, lợi nhuận hấp dẫn và hỗ trợ toàn diện.",
};

export default function FranchisePage() {
  return (
    <MainLayout>
      <div className="bg-surface">
        <FranchiseHero />
        <FranchiseBenefits />
        <FranchiseModels />
        <FranchiseProcess />
        <FranchiseForm />
        <FooterSection />
      </div>
    </MainLayout>
  );
}
