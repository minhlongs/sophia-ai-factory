"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { HeaderNavigation, FooterSection } from "@/components/layout";
import { Typography } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";

interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  note: string;
}

export default function CheckoutPage() {
  const { items, totalPrice } = useCart();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "Hà Nội",
    note: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const shippingFee = totalPrice >= 500000 ? 0 : 30000;
  const grandTotal = totalPrice + shippingFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const response = await fetch("/api/payos/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: grandTotal,
          items: items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.priceVnd,
          })),
          customerInfo,
        }),
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        setPaymentUrl(data.checkoutUrl);
        // Redirect to PayOS checkout
        window.location.href = data.checkoutUrl;
      } else {
        alert("Có lỗi xảy ra. Vui lòng thử lại.");
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex flex-col">
        <HeaderNavigation />
        <main className="flex-1 flex flex-col items-center justify-center py-24 text-center px-6">
          <span className="text-8xl mb-6 block animate-in zoom-in duration-500">🛒</span>
          <Typography variant="headline-medium" className="text-primary mb-4">
            Giỏ hàng trống
          </Typography>
          <Typography variant="body-large" className="text-on-surface-variant mb-8">
            Có vẻ như bạn chưa chọn sản phẩm nào.
          </Typography>
          <Link href="/products">
            <Button variant="filled" size="lg">
              ← Tiếp tục mua sắm
            </Button>
          </Link>
        </main>
        <FooterSection />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1 pt-32 pb-16">
        <div className="container mx-auto px-6 max-w-6xl">
          <Typography
            variant="display-small"
            className="text-primary mb-8 font-bold"
          >
            Thanh toán
          </Typography>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Customer Form */}
            <div className="lg:col-span-2 space-y-6">
              <form id="checkout-form" onSubmit={handleSubmit}>
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-primary">Thông tin giao hàng</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Họ và tên *</Label>
                        <Input
                          id="name"
                          type="text"
                          required
                          value={customerInfo.name}
                          onChange={(e) =>
                            setCustomerInfo({
                              ...customerInfo,
                              name: e.target.value,
                            })
                          }
                          placeholder="Nguyễn Văn A"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Số điện thoại *</Label>
                        <Input
                          id="phone"
                          type="tel"
                          required
                          value={customerInfo.phone}
                          onChange={(e) =>
                            setCustomerInfo({
                              ...customerInfo,
                              phone: e.target.value,
                            })
                          }
                          placeholder="0912 345 678"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={customerInfo.email}
                        onChange={(e) =>
                          setCustomerInfo({
                            ...customerInfo,
                            email: e.target.value,
                          })
                        }
                        placeholder="email@example.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address">Địa chỉ giao hàng *</Label>
                      <Input
                        id="address"
                        type="text"
                        required
                        value={customerInfo.address}
                        onChange={(e) =>
                          setCustomerInfo({
                            ...customerInfo,
                            address: e.target.value,
                          })
                        }
                        placeholder="Số nhà, đường, phường/xã"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">Tỉnh/Thành phố *</Label>
                      <div className="relative">
                        <select
                          id="city"
                          required
                          value={customerInfo.city}
                          onChange={(e) =>
                            setCustomerInfo({
                              ...customerInfo,
                              city: e.target.value,
                            })
                          }
                          className="flex h-12 w-full rounded-md border border-outline bg-surface px-3 py-2 text-sm text-on-surface ring-offset-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                        >
                          <option value="Hà Nội">Hà Nội</option>
                          <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                          <option value="Đà Nẵng">Đà Nẵng</option>
                          <option value="Hải Phòng">Hải Phòng</option>
                          <option value="Cần Thơ">Cần Thơ</option>
                          <option value="Khác">Khác</option>
                        </select>
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none material-symbols-rounded text-on-surface-variant">
                          expand_more
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="note">Ghi chú</Label>
                      <Textarea
                        id="note"
                        value={customerInfo.note}
                        onChange={(e) =>
                          setCustomerInfo({
                            ...customerInfo,
                            note: e.target.value,
                          })
                        }
                        rows={3}
                        placeholder="Ghi chú cho đơn hàng..."
                        className="resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Payment Method */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-primary">
                      Phương thức thanh toán
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 p-4 bg-primary-container/20 rounded-xl border-2 border-primary">
                      <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-on-primary">
                        <span className="material-symbols-rounded text-2xl">
                          account_balance
                        </span>
                      </div>
                      <div>
                        <Typography
                          variant="title-medium"
                          className="text-on-surface font-bold"
                        >
                          Chuyển khoản ngân hàng (VietQR)
                        </Typography>
                        <Typography
                          variant="body-small"
                          className="text-on-surface-variant"
                        >
                          Quét mã QR để thanh toán nhanh chóng
                        </Typography>
                      </div>
                      <div className="ml-auto text-primary">
                        <span className="material-symbols-rounded">check_circle</span>
                      </div>
                    </div>

                    <Typography
                      variant="body-small"
                      className="mt-4 text-on-surface-variant text-center"
                    >
                      Powered by PayOS - Thanh toán an toàn, bảo mật
                    </Typography>
                  </CardContent>
                </Card>
              </form>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-primary">Đơn hàng của bạn</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="max-h-[300px] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-surface-variant rounded-lg flex items-center justify-center flex-shrink-0 text-2xl">
                            {item.image}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Typography
                              variant="title-small"
                              className="text-on-surface truncate font-bold"
                            >
                              {item.name}
                            </Typography>
                            <Typography
                              variant="body-small"
                              className="text-on-surface-variant"
                            >
                              x{item.quantity}
                            </Typography>
                          </div>
                          <Typography
                            variant="label-large"
                            className="text-on-surface font-bold"
                          >
                            {(item.priceVnd * item.quantity).toLocaleString(
                              "vi-VN"
                            )}
                            đ
                          </Typography>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-outline-variant pt-4 space-y-2">
                      <div className="flex justify-between text-on-surface-variant">
                        <Typography variant="body-medium">Tạm tính</Typography>
                        <Typography variant="body-medium">
                          {totalPrice.toLocaleString("vi-VN")}đ
                        </Typography>
                      </div>
                      <div className="flex justify-between text-on-surface-variant">
                        <Typography variant="body-medium">
                          Phí vận chuyển
                        </Typography>
                        <Typography variant="body-medium">
                          {shippingFee === 0
                            ? "Miễn phí"
                            : `${shippingFee.toLocaleString("vi-VN")}đ`}
                        </Typography>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-outline-variant">
                        <Typography
                          variant="title-medium"
                          className="text-on-surface font-bold"
                        >
                          Tổng cộng
                        </Typography>
                        <Typography
                          variant="headline-small"
                          className="text-primary font-bold"
                        >
                          {grandTotal.toLocaleString("vi-VN")}đ
                        </Typography>
                      </div>
                    </div>

                    {totalPrice < 500000 && (
                      <div className="mt-4 p-3 bg-secondary-container/30 rounded-lg border border-secondary/20">
                        <Typography
                          variant="body-small"
                          className="text-on-secondary-container flex items-start gap-2"
                        >
                          <span className="material-symbols-rounded text-secondary text-lg">
                            lightbulb
                          </span>
                          <span>
                            Thêm{" "}
                            <strong>
                              {(500000 - totalPrice).toLocaleString("vi-VN")}đ
                            </strong>{" "}
                            để được miễn phí vận chuyển
                          </span>
                        </Typography>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="submit"
                      form="checkout-form"
                      variant="filled"
                      size="lg"
                      className="w-full text-lg h-14"
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-rounded animate-spin">
                            progress_activity
                          </span>
                          Đang xử lý...
                        </div>
                      ) : (
                        `Thanh toán ${grandTotal.toLocaleString("vi-VN")}đ`
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
