export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription?: string;
  price: number;
  originalPrice?: number;
  weight: string;
  image: string; // Emoji for now, will be URL later
  images?: string[]; // Array of images for gallery
  category: "tea" | "teaware" | "gift";
  type?: "green" | "black" | "white" | "oolong" | "herbal";
  origin?: string;
  harvest?: string;
  taste?: string;
  tags?: string[];
  inStock: boolean;
  featured?: boolean;
  rating?: number;
  reviews?: number;
}

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    slug: "shan-tuyet-co-thu",
    name: "Shan Tuyết Cổ Thụ",
    description: "Hương thơm cốm non, vị ngọt hậu sâu lắng từ Suối Giàng.",
    longDescription: "Trà Shan Tuyết Cổ Thụ được thu hái từ những cây chè hàng trăm năm tuổi trên đỉnh Suối Giàng, Yên Bái. Búp chè to, phủ lớp lông tuyết trắng mịn, khi pha cho nước màu vàng mật ong, hương thơm cốm non nồng nàn và vị ngọt hậu sâu lắng. Đây là tặng phẩm vô giá của núi rừng Tây Bắc.",
    price: 450000,
    weight: "100g",
    image: "🌿",
    images: ["🌿", "🍵", "🍃", "🏔️"],
    category: "tea",
    type: "green",
    origin: "Suối Giàng, Yên Bái",
    harvest: "Vụ Xuân 2024",
    taste: "Chát dịu, ngọt hậu, hương cốm",
    tags: ["Best Seller", "Organic"],
    inStock: true,
    featured: true,
    rating: 4.8,
    reviews: 124
  },
  {
    id: "p2",
    slug: "bach-tra-tien",
    name: "Bạch Trà Tiên",
    description: "Những búp trà phủ lông tuyết trắng, hương hoa cỏ tinh tế.",
    longDescription: "Bạch Trà Tiên là loại trà quý hiếm, chỉ hái một tôm (búp non nhất). Quá trình chế biến tối giản giúp giữ nguyên vẹn hương vị tự nhiên của đất trời. Trà có màu nước trắng ngà, hương thơm hoa cỏ tinh tế, vị thanh mát, giàu chất chống oxy hóa.",
    price: 850000,
    weight: "100g",
    image: "🍵",
    images: ["🍵", "❄️", "🌱"],
    category: "tea",
    type: "white",
    origin: "Tây Côn Lĩnh, Hà Giang",
    harvest: "Vụ Xuân 2024",
    taste: "Thanh mát, hương hoa, ngọt nhẹ",
    tags: ["Premium", "Limited"],
    inStock: true,
    featured: true,
    rating: 4.9,
    reviews: 89
  },
  {
    id: "p3",
    slug: "hong-tra-co-thu",
    name: "Hồng Trà Cổ Thụ",
    description: "Lên men tự nhiên, hương mật ong và trái cây chín.",
    longDescription: "Hồng Trà Cổ Thụ 84tea được lên men 100% từ lá chè Shan Tuyết cổ thụ. Nước trà màu đỏ hổ phách đẹp mắt, hương thơm nồng nàn của mật ong rừng và trái cây chín. Vị trà đậm đà, không chát, để lại dư vị ngọt ngào khó quên.",
    price: 380000,
    weight: "100g",
    image: "🍂",
    images: ["🍂", "🍯", "🥃"],
    category: "tea",
    type: "black",
    origin: "Mộc Châu, Sơn La",
    harvest: "Vụ Hè 2024",
    taste: "Đậm đà, hương mật ong, trái cây",
    tags: ["New", "Warm"],
    inStock: true,
    featured: true,
    rating: 4.7,
    reviews: 56
  },
  {
    id: "p4",
    slug: "hoang-tra-di-san",
    name: "Hoàng Trà Di Sản",
    description: "Công thức chế biến gia truyền, vị êm dịu độc đáo.",
    longDescription: "Hoàng Trà (Trà Vàng) là dòng trà quý tộc, được chế biến qua quy trình 'm悶 hoàng' đặc biệt. Trà có hương thơm thảo mộc nhẹ nhàng, nước vàng óng ả, vị êm dịu, không gắt, rất tốt cho tiêu hóa.",
    price: 550000,
    weight: "100g",
    image: "✨",
    images: ["✨", "👑", "🌼"],
    category: "tea",
    type: "herbal",
    origin: "Thái Nguyên",
    harvest: "Vụ Thu 2023",
    taste: "Êm dịu, thảo mộc, thanh khiết",
    tags: ["Limited", "Heritage"],
    inStock: true,
    featured: true,
    rating: 4.6,
    reviews: 42
  },
  {
    id: "p5",
    slug: "o-long-cao-son",
    name: "Ô Long Cao Sơn",
    description: "Viên tròn đều, hương sữa và hoa lan quyến rũ.",
    longDescription: "Ô Long Cao Sơn được trồng ở độ cao trên 1000m. Lá trà được vo thành viên tròn, khi pha nở ra nguyên búp. Hương thơm đặc trưng của sữa và hoa lan, vị ngọt thanh, chát nhẹ, nước xanh vàng trong vắt.",
    price: 650000,
    weight: "100g",
    image: "🏞️",
    images: ["🏞️", "🌫️", "🍃"],
    category: "tea",
    type: "oolong",
    origin: "Lâm Đồng",
    harvest: "Vụ Đông 2023",
    taste: "Hương sữa, hoa lan, ngọt thanh",
    tags: ["Popular"],
    inStock: true,
    featured: false,
    rating: 4.7,
    reviews: 98
  },
  {
    id: "p6",
    slug: "bo-am-chen-tu-sa",
    name: "Bộ Ấm Chén Tử Sa",
    description: "Chế tác thủ công từ đất tử sa Nghi Hưng cao cấp.",
    longDescription: "Bộ ấm chén Tử Sa được các nghệ nhân chế tác thủ công tỉ mỉ. Chất đất tử sa giữ nhiệt tốt, càng dùng càng bóng đẹp, giúp tôn vinh hương vị trà ngon nhất. Bộ sản phẩm gồm 1 ấm, 6 chén và 1 tống chuyên trà.",
    price: 2500000,
    originalPrice: 3000000,
    weight: "1 bộ",
    image: "🏺",
    images: ["🏺", "🫖", "🎁"],
    category: "teaware",
    origin: "Nghi Hưng",
    tags: ["Handmade", "Luxury"],
    inStock: true,
    featured: false,
    rating: 5.0,
    reviews: 15
  },
  {
    id: "p7",
    slug: "hop-qua-tet-sum-vay",
    name: "Hộp Quà Tết Sum Vầy",
    description: "Kết hợp 3 loại trà thượng hạng, thiết kế sang trọng.",
    longDescription: "Hộp quà Tết 'Sum Vầy' mang thông điệp đoàn viên, hạnh phúc. Bên trong là 3 hũ trà thượng hạng: Shan Tuyết, Hồng Trà và Ô Long. Thiết kế hộp sơn mài sang trọng, thích hợp làm quà biếu đối tác, người thân dịp lễ Tết.",
    price: 1250000,
    weight: "1 set",
    image: "🎁",
    images: ["🎁", "🧧", "✨"],
    category: "gift",
    tags: ["Gift Set", "Seasonal"],
    inStock: true,
    featured: false,
    rating: 4.8,
    reviews: 34
  },
  {
    id: "p8",
    slug: "tra-pho-nhi-song",
    name: "Trà Phổ Nhĩ Sống 2015",
    description: "Bánh trà nén chặt, càng để lâu càng giá trị.",
    longDescription: "Bánh trà Phổ Nhĩ sống được sản xuất năm 2015 từ nguyên liệu Shan Tuyết cổ thụ. Trà có vị chát mạnh ban đầu nhưng ngọt hậu kéo dài, hương thơm của nắng và gió núi rừng. Thích hợp để thưởng thức ngay hoặc lưu trữ lâu dài.",
    price: 1500000,
    weight: "357g",
    image: "💿",
    images: ["💿", "🕰️", "🏔️"],
    category: "tea",
    type: "black",
    origin: "Hà Giang",
    harvest: "2015",
    taste: "Mạnh mẽ, ngọt hậu, hương gỗ",
    tags: ["Aged", "Collector"],
    inStock: true,
    featured: false,
    rating: 4.9,
    reviews: 28
  }
];

export const CATEGORIES = [
  { id: "all", name: "Tất cả" },
  { id: "tea", name: "Trà thưởng thức" },
  { id: "teaware", name: "Ấm chén & Dụng cụ" },
  { id: "gift", name: "Quà tặng" }
];

export const TEA_TYPES = [
  { id: "green", name: "Trà Xanh (Lục Trà)" },
  { id: "black", name: "Hồng Trà" },
  { id: "white", name: "Bạch Trà" },
  { id: "oolong", name: "Trà Ô Long" },
  { id: "herbal", name: "Trà Thảo Mộc" }
];
