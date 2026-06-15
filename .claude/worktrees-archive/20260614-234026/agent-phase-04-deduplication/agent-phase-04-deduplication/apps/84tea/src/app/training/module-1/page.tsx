"use client";

import { useState } from "react";
import Link from "next/link";
import { HeaderNavigation, FooterSection } from "@/components/layout";
import { Typography } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const moduleData = {
  id: 1,
  title: "Văn Hóa & Thương Hiệu",
  titleEn: "Brand & Culture",
  icon: "🎯",
  lessons: [
    {
      id: 1,
      title: "Lịch sử thương hiệu 84tea",
      duration: "10 phút",
      content: `
## Nguồn gốc 84tea

84tea được thành lập từ niềm đam mê với trà Shan Tuyết cổ thụ - loại trà quý hiếm chỉ mọc trên những đỉnh núi cao Tây Bắc Việt Nam.

### Tại sao là "84"?

- **84** là mã quốc gia của Việt Nam (+84)
- Thể hiện niềm tự hào về nguồn gốc Việt Nam
- Mang trà Việt ra thế giới

### Timeline

- **2024**: 3704 Co., LTD thành lập
- **2025**: Ra mắt dòng sản phẩm 84 LIMITED
- **2026**: Mở rộng nhượng quyền toàn quốc

### OEM Partner: 3704 Co., LTD

- GPKD: 011 070 44 89
- Thành lập: 04/05/2024
- Trụ sở: 134 Nguyễn Hoàng Tôn, Phú Thượng, Tây Hồ, Hà Nội
      `,
    },
    {
      id: 2,
      title: "Sứ mệnh và tầm nhìn",
      duration: "8 phút",
      content: `
## Sứ Mệnh

> "Đưa tinh hoa trà Việt Nam đến với thế giới thông qua những sản phẩm chất lượng cao và trải nghiệm khách hàng xuất sắc."

### Tầm Nhìn 2030

- Trở thành thương hiệu trà Việt Nam #1 tại châu Á
- Mạng lưới 500+ cửa hàng nhượng quyền
- Xuất khẩu đến 30+ quốc gia

### Cam Kết

1. **Chất lượng**: Chỉ sử dụng trà từ cây cổ thụ 100+ năm
2. **Truyền thống**: Bảo tồn phương pháp chế biến cổ truyền
3. **Phát triển bền vững**: Hỗ trợ cộng đồng người trồng trà
      `,
    },
    {
      id: 3,
      title: "Giá trị cốt lõi",
      duration: "10 phút",
      content: `
## 5 Giá Trị Cốt Lõi

### 1. 🌿 Chân Thực (Authenticity)
- Nguồn gốc rõ ràng, minh bạch
- Không sử dụng hương liệu nhân tạo
- Trung thực với khách hàng

### 2. ⭐ Xuất Sắc (Excellence)
- Luôn nỗ lực vượt kỳ vọng
- Cải tiến liên tục
- Chất lượng nhất quán

### 3. 🤝 Kết Nối (Connection)
- Xây dựng cộng đồng yêu trà
- Kết nối người trồng với người thưởng trà
- Văn hóa trà gắn kết mọi người

### 4. 🌱 Bền Vững (Sustainability)
- Thu mua công bằng từ nông dân
- Bao bì thân thiện môi trường
- Phát triển dài hạn

### 5. ❤️ Đam Mê (Passion)
- Yêu những gì mình làm
- Truyền cảm hứng cho khách hàng
- Không ngừng học hỏi
      `,
    },
    {
      id: 4,
      title: "Câu chuyện trà Shan Tuyết",
      duration: "12 phút",
      content: `
## Trà Shan Tuyết Cổ Thụ

### Đặc điểm

- Cây trà hoang dã, mọc tự nhiên trên núi cao
- Tuổi đời 100-400+ năm
- Chỉ có ở Việt Nam, Lào, Myanmar

### Vùng trồng chính

| Vùng | Độ cao | Đặc điểm |
|------|--------|----------|
| Yên Bái | 1,200m | Vị ngọt hậu |
| Hà Giang | 1,500m | Hương hoa mạnh |
| Sơn La | 1,000m | Vị đậm đà |

### Quy trình thu hái

1. **Chọn búp**: Búp non 1 tôm 2 lá
2. **Thu hái tay**: Không dùng máy
3. **Sơ chế**: Trong 4 giờ sau hái
4. **Lên men**: 14-180 ngày

### Tại sao trà cổ thụ đặc biệt?

- Rễ sâu hơn → hấp thụ nhiều khoáng chất
- Không phun thuốc → 100% organic
- Số lượng giới hạn → quý hiếm
      `,
    },
    {
      id: 5,
      title: "Tiêu chuẩn phục vụ 84tea",
      duration: "5 phút",
      content: `
## Tiêu Chuẩn Phục Vụ

### Nguyên tắc S.E.R.V.E

- **S**mile: Luôn mỉm cười
- **E**ye contact: Giao tiếp bằng mắt
- **R**espect: Tôn trọng mọi khách hàng
- **V**alue: Tạo giá trị cho khách
- **E**xperience: Mang đến trải nghiệm tốt nhất

### Thời gian chuẩn

| Action | Thời gian |
|--------|-----------|
| Chào khách | < 5 giây |
| Phục vụ trà | < 7 phút |
| Thanh toán | < 2 phút |

### Đồng phục

- Áo polo xanh 84tea
- Tạp dề đen có logo
- Name tag
- Giày kín mũi
      `,
    },
  ],
  quiz: [
    {
      id: 1,
      question: '84 trong "84tea" có ý nghĩa gì?',
      options: [
        "Năm thành lập",
        "Mã quốc gia Việt Nam (+84)",
        "Số loại trà",
        "Tuổi cây trà",
      ],
      correct: 1,
    },
    {
      id: 2,
      question: "Trà Shan Tuyết cổ thụ có tuổi đời bao nhiêu?",
      options: ["10-50 năm", "50-100 năm", "100-400+ năm", "Dưới 10 năm"],
      correct: 2,
    },
    {
      id: 3,
      question: "Nguyên tắc S.E.R.V.E, chữ R có nghĩa là gì?",
      options: ["Respond", "Respect", "Recommend", "Reward"],
      correct: 1,
    },
    {
      id: 4,
      question: "Thời gian chuẩn để chào khách là bao lâu?",
      options: ["< 30 giây", "< 10 giây", "< 5 giây", "< 1 phút"],
      correct: 2,
    },
    {
      id: 5,
      question: "Tầm nhìn 2030 của 84tea là gì?",
      options: [
        "100 cửa hàng",
        "500+ cửa hàng, top 1 châu Á",
        "Chỉ bán online",
        "Không mở rộng",
      ],
      correct: 1,
    },
  ],
};

export default function Module1Page() {
  const [currentLesson, setCurrentLesson] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [showResults, setShowResults] = useState(false);

  const lesson = moduleData.lessons[currentLesson];

  const handleQuizAnswer = (questionIndex: number, answerIndex: number) => {
    const newAnswers = [...quizAnswers];
    newAnswers[questionIndex] = answerIndex;
    setQuizAnswers(newAnswers);
  };

  const calculateScore = () => {
    let correct = 0;
    moduleData.quiz.forEach((q, i) => {
      if (quizAnswers[i] === q.correct) correct++;
    });
    return Math.round((correct / moduleData.quiz.length) * 100);
  };

  if (showResults) {
    const score = calculateScore();
    const passed = score >= 80;

    return (
      <div className="min-h-screen bg-surface flex flex-col">
        <HeaderNavigation />
        <main className="flex-1 pt-32 pb-24 flex items-center justify-center">
          <div className="max-w-2xl mx-auto px-6 text-center w-full">
            <Card
              className={`p-12 shadow-xl border-4 ${
                passed ? "border-primary" : "border-error"
              }`}
            >
              <CardContent>
                <span className="text-6xl mb-4 block">
                  {passed ? "🎉" : "📚"}
                </span>
                <Typography
                  variant="headline-medium"
                  className="font-display text-on-surface mb-4"
                >
                  {passed ? "Chúc mừng!" : "Hãy thử lại"}
                </Typography>
                <Typography
                  variant="display-medium"
                  className="font-bold text-primary mb-4"
                >
                  {score}%
                </Typography>
                <Typography
                  variant="body-large"
                  className="text-on-surface-variant mb-8"
                >
                  {passed
                    ? `Bạn đã hoàn thành Module 1 với điểm ${score}%!`
                    : `Bạn cần đạt tối thiểu 80% để pass. Hãy xem lại bài học.`}
                </Typography>
                <div className="flex flex-col gap-4">
                  {passed ? (
                    <Link href="/training/module-2">
                      <Button variant="filled" size="lg" className="w-full">
                        Tiếp tục Module 2 →
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      onClick={() => {
                        setShowQuiz(false);
                        setShowResults(false);
                        setQuizAnswers([]);
                        setCurrentLesson(0);
                      }}
                      variant="filled"
                      size="lg"
                      className="w-full"
                    >
                      Xem lại bài học
                    </Button>
                  )}
                  <Link href="/training">
                    <Button variant="outlined" size="lg" className="w-full">
                      Về trang Training
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <FooterSection />
      </div>
    );
  }

  if (showQuiz) {
    return (
      <div className="min-h-screen bg-surface flex flex-col">
        <HeaderNavigation />
        <main className="flex-1 pt-28 pb-16">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-8">
              <Typography
                variant="headline-medium"
                className="font-display text-on-surface mb-2"
              >
                Quiz: {moduleData.title}
              </Typography>
              <Typography variant="body-medium" className="text-on-surface-variant">
                Trả lời {moduleData.quiz.length} câu hỏi (cần đạt ≥80% để pass)
              </Typography>
            </div>

            <div className="space-y-6">
              {moduleData.quiz.map((q, qIndex) => (
                <Card key={q.id} className="shadow-sm border-none bg-surface-container-low">
                  <CardContent className="p-6">
                    <Typography
                      variant="title-medium"
                      className="font-semibold text-on-surface mb-4"
                    >
                      {qIndex + 1}. {q.question}
                    </Typography>
                    <div className="space-y-2">
                      {q.options.map((option, oIndex) => (
                        <label
                          key={oIndex}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border-2 ${
                            quizAnswers[qIndex] === oIndex
                              ? "bg-primary-container border-primary text-on-primary-container"
                              : "bg-surface border-transparent hover:bg-surface-container-high text-on-surface"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q${qIndex}`}
                            checked={quizAnswers[qIndex] === oIndex}
                            onChange={() => handleQuizAnswer(qIndex, oIndex)}
                            className="w-4 h-4 accent-primary"
                          />
                          <Typography variant="body-medium" className="text-on-surface">
                            {option}
                          </Typography>
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Button
                onClick={() => setShowResults(true)}
                disabled={quizAnswers.length !== moduleData.quiz.length}
                variant="filled"
                size="lg"
                className="px-12"
              >
                Nộp bài
              </Button>
            </div>
          </div>
        </main>
        <FooterSection />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <HeaderNavigation />

      <main className="flex-1 pt-28 pb-16">
        <div className="max-w-5xl mx-auto px-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/training">
              <Button
                variant="outlined"
                size="icon"
                className="rounded-full bg-surface"
              >
                ←
              </Button>
            </Link>
            <div>
              <Typography
                variant="label-large"
                className="text-secondary font-semibold"
              >
                Module {moduleData.id}
              </Typography>
              <Typography
                variant="headline-medium"
                className="font-display text-on-surface"
              >
                {moduleData.title}
              </Typography>
            </div>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24 bg-surface-container-low border-none shadow-sm">
                <CardContent className="p-4">
                  <Typography
                    variant="title-small"
                    className="font-semibold text-on-surface mb-4"
                  >
                    Nội dung
                  </Typography>
                  <div className="space-y-1">
                    {moduleData.lessons.map((l, i) => (
                      <button
                        key={l.id}
                        onClick={() => setCurrentLesson(i)}
                        className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                          i === currentLesson
                            ? "bg-primary text-on-primary font-medium"
                            : "hover:bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        {i + 1}. {l.title}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Content */}
            <div className="lg:col-span-3">
              <Card className="bg-surface-container-low border-none shadow-sm min-h-[500px]">
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-6 border-b border-outline-variant pb-4">
                    <Typography
                      variant="headline-small"
                      className="font-display text-on-surface"
                    >
                      {lesson.title}
                    </Typography>
                    <Typography
                      variant="body-small"
                      className="text-on-surface-variant"
                    >
                      ⏱️ {lesson.duration}
                    </Typography>
                  </div>

                  <div className="prose prose-lg max-w-none text-on-surface-variant prose-headings:text-primary prose-headings:font-display prose-strong:text-on-surface">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: lesson.content.replace(/\n/g, "<br/>"),
                      }}
                    />
                  </div>

                  <div className="flex justify-between mt-12 pt-6 border-t border-outline-variant">
                    <Button
                      onClick={() =>
                        setCurrentLesson((c) => Math.max(0, c - 1))
                      }
                      disabled={currentLesson === 0}
                      variant="outlined"
                    >
                      ← Bài trước
                    </Button>

                    {currentLesson === moduleData.lessons.length - 1 ? (
                      <Button onClick={() => setShowQuiz(true)} variant="filled">
                        Làm Quiz →
                      </Button>
                    ) : (
                      <Button
                        onClick={() =>
                          setCurrentLesson((c) =>
                            Math.min(moduleData.lessons.length - 1, c + 1)
                          )
                        }
                        variant="filled"
                      >
                        Bài tiếp →
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <FooterSection />
    </div>
  );
}
