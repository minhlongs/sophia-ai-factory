# Báo Cáo Kiến Trúc: Hybrid AGI cho Sophia AI Factory

**Ngày:** 14/02/2026
**Tác giả:** Architect Agent (AI Team)
**Trạng thái:** Đã phê duyệt

## 1. Tổng Quan Kiến Trúc (Hybrid AGI)

Hệ thống AGI của Sophia AI Factory sẽ chuyển từ mô hình "Linear Automation" sang "Autonomous Agentic Workflow". Kiến trúc này sử dụng mô hình **Hybrid**, kết hợp giữa một **Strategic Meta-Agent** (Bộ não chiến lược) và các **Tactical Agent Teams** (Đội thực thi chuyên biệt).

### Sơ đồ tư duy:
```mermaid
graph TD
    UserInput[User Request] --> MetaAgent[🧠 Strategic Meta-Agent]
    MetaAgent -->|Plan & Delegate| Orchestrator[Inngest Orchestrator]

    subgraph Tactical Teams
        Orchestrator --> ScriptAgent[📝 Scriptwriter Agent]
        Orchestrator --> VoiceAgent[🗣️ Voice Artist Agent]
        Orchestrator --> VisualAgent[🎨 Visual Director Agent]
    end

    ScriptAgent -->|Draft| ReviewGate[Quality Gate]
    VoiceAgent -->|Audio| ReviewGate
    VisualAgent -->|Assets| ReviewGate

    ReviewGate -->|Approved| Production[🎬 Video Rendering]
    ReviewGate -->|Rejected| FeedbackLoop[🔄 Self-Correction]
    FeedbackLoop --> MetaAgent

    subgraph AGI Memory
        VectorDB[(PgVector Knowledge Base)]
        Telemetry[(AGI Events & Analytics)]
    end

    MetaAgent <--> VectorDB
    Tactical Teams <--> VectorDB
```

## 2. Các Thành Phần Cốt Lõi

### 2.1. Strategic Meta-Agent (The Brain)
- **Vai trò:** Phân tích ý định người dùng (Intent Analysis), lập kế hoạch sản xuất (Production Planning), và điều phối tài nguyên.
- **Công nghệ:** LLM (Claude 3.5 Sonnet / GPT-4o) + Function Calling.
- **Đầu vào:** "Làm video quảng cáo cho quán trà sữa mới mở, phong cách Gen Z."
- **Đầu ra:** Bản kế hoạch chi tiết (JSON Plan) bao gồm cấu trúc video, tone-mood, và phân công task.

### 2.2. Tactical Agent Teams (The Hands)
Mỗi agent chuyên trách một nhiệm vụ cụ thể, hoạt động song song hoặc tuần tự:
- **Scriptwriter Agent:** Chuyên viết kịch bản, phân cảnh, lời thoại. Sử dụng kiến thức về viral marketing.
- **Voice Artist Agent:** Lựa chọn giọng đọc (ElevenLabs), điều chỉnh tốc độ, cảm xúc.
- **Visual Director Agent:** Lựa chọn Avatar (HeyGen), tạo prompt cho background (Midjourney/DALL-E).

### 2.3. AGI Memory (The Soul)
- **Cơ chế:** Lưu trữ ngữ nghĩa (Semantic Storage) sử dụng `pgvector` trên Supabase.
- **Dữ liệu:**
  - **Templates:** Các mẫu kịch bản thành công.
  - **User Preferences:** Gu thẩm mỹ của từng user.
  - **Performance Metrics:** Video nào có tỉ lệ xem cao (từ Telemetry).

### 2.4. Feedback Loop (Self-Improvement)
- Hệ thống tự học từ các hành động chỉnh sửa của người dùng.
- Ví dụ: Nếu Meta-Agent chọn giọng "Nam trầm" nhưng user đổi sang "Nữ cao", hệ thống sẽ ghi nhớ preference này vào Vector DB.

## 3. Lộ Trình Triển Khai (Phased Rollout)

- **Phase 1: Foundation (Hôm nay):** Thiết lập Database Schema, AGI Core Types, Vector Store.
- **Phase 2: Meta-Agent Logic:** Xây dựng logic phân tích intent và lập plan cơ bản.
- **Phase 3: Tactical Integration:** Tích hợp các tool AI (Script, Voice) vào luồng Inngest.
- **Phase 4: Autonomous Loop:** Kích hoạt khả năng tự sửa lỗi và học tập.

## 4. Rủi Ro & Giải Pháp
- **Chi phí Token:** Sử dụng Cache và mô hình nhỏ (Haiku/Flash) cho các task đơn giản.
- **Độ trễ (Latency):** Tối ưu hóa Inngest steps, chạy song song (Parallel execution) nơi có thể.
- **Ảo giác (Hallucination):** Luôn có bước "Human in the loop" (Review Gate) trước khi render tốn phí.
