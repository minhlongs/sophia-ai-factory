"use client";

import { useState, useMemo, useEffect } from "react";
import { Typography } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/ui/chips";
import { MainLayout, FooterSection } from "@/components/layout";
import { ProductCard } from "@/components/products/product-card";
import { ProductFilter } from "@/components/products/product-filter";
import { PRODUCTS } from "@/lib/data/products";

// MD3 Filter Categories (as per requirements)
const CATEGORIES = [
  "Tất cả",
  "Trà truyền thống",
  "Trà sữa",
  "Trà trái cây",
  "Specialty",
  "Toppings"
];

export default function ProductsPage() {
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const [activeType, setActiveType] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000000]);
  const [sortBy, setSortBy] = useState("featured");
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Filter Logic
  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((product) => {
      // 1. Filter by Category
      if (activeCategory !== "Tất cả" && product.category !== activeCategory) {
        return false;
      }

      // 2. Filter by Type (only for tea category)
      if (activeType && product.type !== activeType) {
        return false;
      }

      // 3. Filter by Price
      if (product.price < priceRange[0] || product.price > priceRange[1]) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // 4. Sort
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "featured") return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      return 0;
    });
  }, [activeCategory, activeType, priceRange, sortBy]);

  // Scroll to top when category changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeCategory]);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <MainLayout>
        {/* Header */}
        <div className="bg-surface-container-low py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/patterns/pattern-1.svg')] opacity-[0.03]"></div>
        <div className="container mx-auto px-6 relative z-10 text-center">
          <Typography variant="label-large" className="text-secondary uppercase tracking-widest mb-4">
            Cửa hàng trực tuyến
          </Typography>
          <Typography variant="display-medium" className="font-display text-primary mb-6">
            Tinh hoa Trà Việt
          </Typography>
          <Typography variant="body-large" className="max-w-2xl mx-auto text-on-surface-variant">
            Khám phá bộ sưu tập trà cổ thụ và trà cụ cao cấp, được tuyển chọn kỹ lưỡng từ những vùng nguyên liệu trứ danh của Việt Nam.
          </Typography>
        </div>
      </div>

      {/* MD3 Filter Chips */}
      <div className="container mx-auto px-6 mt-8">
        <FilterChips
          categories={CATEGORIES}
          selected={activeCategory}
          onSelect={setActiveCategory}
        />
      </div>

      <div className="container mx-auto px-6 mt-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar Filter - Desktop */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <ProductFilter
              activeCategory={activeCategory}
              activeType={activeType}
              priceRange={priceRange}
              onCategoryChange={setActiveCategory}
              onTypeChange={setActiveType}
              onPriceChange={setPriceRange}
              onClear={() => {
                setActiveCategory("Tất cả");
                setActiveType(null);
                setPriceRange([0, 10000000]);
              }}
            />
          </aside>

          {/* Mobile Filter Trigger */}
          <div className="lg:hidden mb-6 flex items-center justify-between">
            <Button
              variant="outlined"
              onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
              className="flex items-center gap-2"
            >
              <span className="material-symbols-rounded">filter_list</span>
              Bộ lọc ({activeCategory !== 'Tất cả' ? 1 : 0})
            </Button>

            <select
              className="px-4 py-2 rounded-lg border border-outline-variant bg-surface text-sm"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="featured">Nổi bật</option>
              <option value="price-asc">Giá: Thấp đến Cao</option>
              <option value="price-desc">Giá: Cao đến Thấp</option>
              <option value="name">Tên A-Z</option>
            </select>
          </div>

          {/* Mobile Filter Drawer (Simple implementation) */}
          {isMobileFilterOpen && (
            <div className="lg:hidden mb-8 border-b border-outline-variant pb-8 animate-in fade-in slide-in-from-top-4">
              <ProductFilter
                activeCategory={activeCategory}
                activeType={activeType}
                priceRange={priceRange}
                onCategoryChange={setActiveCategory}
                onTypeChange={setActiveType}
                onPriceChange={setPriceRange}
                onClear={() => {
                  setActiveCategory("all");
                  setActiveType(null);
                  setPriceRange([0, 10000000]);
                }}
              />
            </div>
          )}

          {/* Product Grid */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="hidden lg:flex items-center justify-between mb-8 pb-4 border-b border-outline-variant">
              <Typography variant="body-medium" className="text-on-surface-variant">
                Hiển thị <span className="font-bold text-on-surface">{filteredProducts.length}</span> sản phẩm
              </Typography>

              <div className="flex items-center gap-3">
                <label className="text-sm text-on-surface-variant">Sắp xếp theo:</label>
                <select
                  className="px-4 py-2 rounded-lg border border-outline-variant bg-surface text-sm focus:border-primary outline-none cursor-pointer hover:border-primary transition-colors"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="featured">Nổi bật nhất</option>
                  <option value="price-asc">Giá: Thấp đến Cao</option>
                  <option value="price-desc">Giá: Cao đến Thấp</option>
                  <option value="name">Tên A-Z</option>
                </select>
              </div>
            </div>

            {/* Grid */}
            {filteredProducts.length > 0 ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-24 bg-surface-container rounded-2xl border border-dashed border-outline-variant">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm">
                  🤔
                </div>
                <Typography variant="title-large" className="mb-2">
                  Không tìm thấy sản phẩm
                </Typography>
                <Typography variant="body-medium" className="text-on-surface-variant mb-6">
                  Thử thay đổi bộ lọc hoặc tìm kiếm từ khóa khác.
                </Typography>
                <Button
                  variant="filled"
                  onClick={() => {
                    setActiveCategory("all");
                    setActiveType(null);
                    setPriceRange([0, 10000000]);
                  }}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            )}
          </div>
          </div>
        </div>
        <FooterSection />
      </MainLayout>
    </div>
  );
}
