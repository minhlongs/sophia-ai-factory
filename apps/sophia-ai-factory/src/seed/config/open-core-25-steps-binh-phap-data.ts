/**
 * Binh Pháp data: the 13 chapters and their mapping to the 25-step blueprint.
 * Kept separate from the helper module so neither file exceeds the 180-LOC cap.
 *
 * Layer: seed/config
 * @module seed/config/open-core-25-steps-binh-phap-data
 */

/** One Art of War chapter: number, glyphs, and bilingual name. */
export interface BinhPhapThiên {
  readonly number: number;
  readonly hanzi: string;
  readonly sinoVietnamese: string;
  readonly titleVi: string;
  readonly titleEn: string;
}

/** The 13 chapters, canonical order. */
export const BINH_PHAP_THIEN: readonly BinhPhapThiên[] = [
  { number: 1, hanzi: '始計', sinoVietnamese: 'Sơ tính', titleVi: 'Tính kế trước khi hành — dò, cân, chọn', titleEn: 'Lay the plan first — assess, calculate, decide' },
  { number: 2, hanzi: '作戰', sinoVietnamese: 'Tác chiến', titleVi: 'Chi phí và sự bền bỉ — đừng thắng trận mà chảy máu kho', titleEn: 'Cost and endurance — never win by emptying your own store' },
  { number: 3, hanzi: '謀攻', sinoVietnamese: 'Mưu công', titleVi: 'Thắng bằng mưu, không bằng đánh — lấy nguyên khối', titleEn: 'Win by strategy, not fighting — take it whole' },
  { number: 4, hanzi: '軍形', sinoVietnamese: 'Quân hình', titleVi: 'Tự làm mình bất bại trước đã', titleEn: 'Make yourself undefeatable first' },
  { number: 5, hanzi: '兵勢', sinoVietnamese: 'Binh thế', titleVi: 'Dựng thế rồi buông đúng lúc', titleEn: 'Build momentum, then release at the right moment' },
  { number: 6, hanzi: '虛實', sinoVietnamese: 'Hư thật', titleVi: 'Chọn chỗ trống để đánh, tránh chỗ mạnh', titleEn: 'Hit the empty, avoid the strong' },
  { number: 7, hanzi: '軍爭', sinoVietnamese: 'Quân tranh', titleVi: 'Tranh thủ lợi thế trên đường đi', titleEn: 'Contend for advantage on the way' },
  { number: 8, hanzi: '九變', sinoVietnamese: 'Cửu biến', titleVi: 'Biến cách làm theo hoàn cảnh', titleEn: 'Vary the method against circumstance' },
  { number: 9, hanzi: '行軍', sinoVietnamese: 'Hành quân', titleVi: 'Điều quân, cửa ải và trật tự hành tiến', titleEn: 'Marshalling, passes, and order in movement' },
  { number: 10, hanzi: '地形', sinoVietnamese: 'Địa hình', titleVi: 'Đọc đất trước khi đặt quân', titleEn: 'Read the ground before placing forces' },
  { number: 11, hanzi: '九地', sinoVietnamese: 'Cửu địa', titleVi: 'Nhận biết mình đang đứng ở địa nào', titleEn: 'Know which ground you are standing on' },
  { number: 12, hanzi: '火攻', sinoVietnamese: 'Hỏa công', titleVi: 'Phương pháp mạnh — đúng thì thắng, sai thì tự thiêu', titleEn: 'A decisive method — decisive when proper, ruinous when misused' },
  { number: 13, hanzi: '用間', sinoVietnamese: 'Dụng gian', titleVi: 'Biết trước bằng người và bằng tin', titleEn: 'Know first through people and intelligence' },
] as const;

/** Which chapter a step is filed under, plus the bilingual reason. */
export interface BinhPhapStepMapping {
  readonly step: number;
  readonly thiênNumber: number;
  readonly justificationVi: string;
  readonly justificationEn: string;
}

/** The mapping for all 25 steps. Every chapter is used at least once. */
export const BINH_PHAP_STEP_MAPPING: readonly BinhPhapStepMapping[] = [
  { step: 1, thiênNumber: 1, justificationVi: 'Khung Open-Core được dựng trước khi viết code: phân chia Community/Cloud/Enterprise chính là "tính kế" — cân năm điều rồi mới phát quân.', justificationEn: 'The master framework precedes any code: partitioning Community/Cloud/Enterprise is laying the plan and weighing conditions before acting.' },
  { step: 2, thiênNumber: 1, justificationVi: 'Làm mới kế hoạch theo số liệu thật (MRR, giá, tiến độ) là tính lại kế trước khi đi tiếp — không tự cho mình một bản kế hoạch dối mình.', justificationEn: 'Refreshing the plan against real numbers (MRR, pricing, progress) is recalculating the plan before marching again, not flattering yourself.' },
  { step: 3, thiênNumber: 3, justificationVi: 'Thiết kế Agentic OS theo quyền tối thiểu thắng bằng chỗ không để agent gây hại được — đúng tinh thần lấy nguyên khối, không phải đánh rồi sửa.', justificationEn: 'Least-privilege agent design wins by leaving no opening to be harmed — taking the position whole instead of fighting then repairing.' },
  { step: 4, thiênNumber: 4, justificationVi: 'Chuỗi bằng chứng Merkle và căn cứ kiểm toán được dựng trước khi doanh thu tới — tự làm mình bất bại trước, không đợi lúc phải trả lời.', justificationEn: 'The Merkle evidence chain and audit baseline are built before revenue arrives — making yourself undefeatable first, not answering when asked.' },
  { step: 5, thiênNumber: 2, justificationVi: 'Báo cáo lỗ hổng và lộ trình lái về khách trả tiền đầu tiên là bài toán hậu cần: chạy bền với nguồn lực ít, không phải đánh nhanh rồi cạn.', justificationEn: 'The gap report and roadmap to a first paying customer is a logistics problem: enduring on thin supply, not charging fast and running dry.' },
  { step: 6, thiênNumber: 2, justificationVi: 'Kinh tế đơn vị nhìn thẳng phí thanh toán, hosting và thời gian hỗ trợ — chính là chỗ binh pháp cảnh báo: thắng trận mà chảy máu kho thì thua.', justificationEn: 'Unit economics faces fees, hosting and support hours squarely — the chapter\'s warning that winning a battle by bleeding your store is losing.' },
  { step: 7, thiênNumber: 13, justificationVi: 'Persona được xác nhận bằng phỏng vấn khách thật là biết trước bằng người: thu tin có cơ sở trước khi bỏ vốn.', justificationEn: 'Personas confirmed by real interviews are knowing-first-through-people: gathering grounded intelligence before committing capital.' },
  { step: 8, thiênNumber: 6, justificationVi: 'Định vị "mở code để kiểm chứng được" đánh vào chỗ trống là lòng tin, thay vì chọi tiền quảng cáo chỗ đối thủ đang mạnh.', justificationEn: 'Positioning on inspectable code attacks the empty place — distrust — rather than fighting ad-spend where rivals are strong.' },
  { step: 9, thiênNumber: 9, justificationVi: 'Trụ cột nội dung và hướng dẫn tự cài đặt là điều quân: dọn đường đi để người ta theo được vào, không chỉ đứng gọi.', justificationEn: 'Content pillars and self-hosting docs are marshalling: clearing the route so people can actually follow, not just shouting from camp.' },
  { step: 10, thiênNumber: 7, justificationVi: 'Cầu chuyển tiếp GitHub sang Cloud kiếm lợi thế ở đường ranh giữa hai trận địa — tranh thủ điểm tiếp cận, không tấn công thẳng.', justificationEn: 'The GitHub-to-Cloud bridge contends for the seam between two grounds — taking the approach, not assaulting either front.' },
  { step: 11, thiênNumber: 5, justificationVi: 'Thử nghiệm creatives theo bandit là dựng thế rồi buông: đổ lực vào biến thể đang tự có động lượng.', justificationEn: 'Bandit creative testing is building momentum then releasing: force flows into whichever variant is already gathering energy.' },
  { step: 12, thiênNumber: 8, justificationVi: 'Quy tắc case study buộc chỉ kể kết quả đã được khách đồng ý dùng — biến cách kể theo sự thật, không ép một khuôn lên mọi trường hợp.', justificationEn: 'Case-study rules require only consented, real outcomes — varying the telling to the facts instead of forcing one template everywhere.' },
  { step: 13, thiênNumber: 7, justificationVi: 'Chuỗi lifecycle song ngữ phải đúng lúc người dùng tự đi tới (xong Setup Wizard, xong video đầu) — tranh thủ lợi thế ở chỗ họ đang đứng.', justificationEn: 'Lifecycle sequences must land where users already walk (Setup Wizard done, first video done) — contending for advantage where they already are.' },
  { step: 14, thiênNumber: 3, justificationVi: 'Phễu Workspace Portability biến self-hoster thành khách bằng thu nạp, không bằng công kích — lấy nguyên khối sang.', justificationEn: 'The portability funnel converts self-hosters by taking them in whole rather than attacking — winning by recruitment, not assault.' },
  { step: 15, thiênNumber: 11, justificationVi: 'Bullseye GTM và affiliate buộc phải biết mình đang đứng ở địa nào trước khi bỏ tiền vào kênh — mỗi địa đòi cách đi khác nhau.', justificationEn: 'GTM and affiliate demand knowing which ground you stand on before spending on a channel — each ground asks a different march.' },
  { step: 16, thiênNumber: 10, justificationVi: 'AARRR và beacon đo đúng đất đang đi: stars, clone, ping, kích hoạt — không tự đo trên đất mình tưởng.', justificationEn: 'AARRR and the beacon measure the ground you are actually on: stars, clones, pings, activations — not the ground you imagined.' },
  { step: 17, thiênNumber: 11, justificationVi: 'Câu chuyện vốn huy động phải nói đúng mình đang ở "cửu địa" nào (Zero → PSF) vì mỗi bước yêu cầu một phép ứng phó.', justificationEn: 'The fundraising narrative must state honestly which ground you occupy (Zero → PSF), because each ground demands a different response.' },
  { step: 18, thiênNumber: 12, justificationVi: 'Ranh giới bản quyền kép và vệ sinh secret là thứ lực mạnh nhất mà dễ tự thiêu nhất — xài sai một dòng là lộ mã nguồn công khai.', justificationEn: 'Dual-license boundaries and secret hygiene are the sharpest force here and the easiest to turn on yourself: one wrong line exposes the open core.' },
  { step: 19, thiênNumber: 8, justificationVi: 'Tổ chức một founder cộng bầy agent được thiết kế để biến hình theo tải và quy mô — không thuê sớm, không giữ cố định một hình dạng.', justificationEn: 'A founder-plus-agent org is designed to change shape with load and scale — not hiring early, not freezing into one form.' },
  { step: 20, thiênNumber: 10, justificationVi: 'Soi gương Supabase, PostHog, Cal.com là đọc đất người ta đã đi trước khi đặt quân mình — khỏi đoán.', justificationEn: 'Benchmarking Supabase, PostHog and Cal.com is reading ground others have crossed before placing your own forces.' },
  { step: 21, thiênNumber: 4, justificationVi: 'Data room chỉ chứa bằng chứng đã đối chiếu nguồn là tự làm mình bất bại trước câu hỏi — không để một con số thiếu căn cứ vào hồ sơ.', justificationEn: 'A data room holding only source-verified evidence makes you undefeatable before the question arrives — no unanchored number enters the file.' },
  { step: 22, thiênNumber: 2, justificationVi: 'OKR quý là tính toán hậu cần: ba mục tiêu vừa sức (3 pilot, 500 stars, 5 di trú) thay vì kéo dài chiến trận quá sức.', justificationEn: 'Quarterly OKRs are logistics arithmetic: three sized targets (3 pilots, 500 stars, 5 migrations) instead of a war that outlasts your supply.' },
  { step: 23, thiênNumber: 4, justificationVi: 'Buổi rà soát tháng của founder ghi sổ tiền thu, hổng và quyết định — giữ hình dạng vững trước khi thị trường chấn.', justificationEn: 'The monthly founder review records cash, gaps and decisions — holding your shape steady before the market shakes it.' },
  { step: 24, thiênNumber: 12, justificationVi: 'BYOK, tối thiểu dữ liệu và công bố nội dung tổng hợp là thứ hỏa lực nhạy nhất: xài đúng thì tạo niềm tin, xài sai là tự thiêu danh tiếng.', justificationEn: 'BYOK, data minimisation and synthetic-media disclosure are the most sensitive force here: used well they build trust, misused they burn reputation.' },
  { step: 25, thiênNumber: 11, justificationVi: 'Playbook khủng hoảng xoáy quanh việc nhận ra đang đứng ở địa nào (SHA lệch, thẻ lỗi công khai) rồi phản ứng đúng cách: rollback, giết kênh, thông báo.', justificationEn: 'The crisis playbook turns on recognising the ground you are on (SHA drift, public bug) and answering correctly: rollback, kill switch, notify.' },
] as const;
