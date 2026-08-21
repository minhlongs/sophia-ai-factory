# Buzz Boundary / Ranh giới Buzz

> Three-layer orchestration: Mekong (control plane) | Buzz (autonomous execution) | Sophia (creative domain).
> Rule: Do not create a fourth competing orchestration layer.

---

## EN / Tiếng Anh

### The Three Layers / Ba Layer

| Layer | Role | What it owns |
|---|---|---|
| **Mekong** | Control plane | User-facing CLI, status, config, task submission. Decides WHAT to run. |
| **Buzz** | Autonomous execution | Runs agent loops autonomously. Decides HOW to execute within a task. |
| **Sophia** | Creative domain | Content strategy, creation, distribution, performance. Decides WHAT is creative. |

### Interaction Model / Mô hình tương tác

```
User → Mekong (control plane)
  Mekong → Buzz (dispatch task)
    Buzz → Sophia (creative domain logic)
      Sophia → Providers (AI calls)
      Sophia → Channels (distribution)
    Buzz → Mekong (status update)
  Mekong → User (progress report)
```

### What Mekong Does / Mekong làm gì

- Accepts user commands (`/campaign`, `/status`, `/results`)
- Submits tasks to Buzz with context and constraints
- Monitors Buzz execution progress
- Returns status to user

### What Buzz Does / Buzz làm gì

- Receives task from Mekong with constraints
- Selects models, tools, and execution strategy autonomously
- Manages retries, fallbacks, and error recovery
- Reports progress back to Mekong

### What Sophia Does / Sophia làm gì

- Provides creative domain knowledge to Buzz
- Validates creative output quality
- Manages creative memory and learning
- Handles distribution and performance tracking

### Anti-Pattern / Mẫu cần tránh

**Do NOT create a fourth orchestration layer.** If you need to coordinate across Mekong + Buzz + Sophia, use Mekong's control plane. Adding a fourth coordinator creates:
- Unclear ownership of task lifecycle
- Competing status reporting
- Race conditions between orchestration layers

### Current Status / Trạng thái hiện tại

Sophia currently operates without Mekong or Buzz integration. When Mekong CLI integration is added:
1. Sophia's creative domain logic remains in `seed/ai/` and `tree/`
2. Mekong orchestrates task submission and status
3. Buzz handles autonomous execution loops
4. No new orchestration layer is created

---

## VN / Tiếng Việt

### Ba Layer

| Layer | Vai trò | Chủ sở hữu |
|---|---|---|
| **Mekong** | Control plane | CLI, status, config, submit task. Quyết định CHẠY gì. |
| **Buzz** | Thực thi tự động | Agent loop tự động. Quyết định THỰC THI thế nào. |
| **Sophia** | Creative domain | Chiến lược sáng tạo, tạo, phân phối, hiệu suất. Quyết định SÁNG TẠO gì. |

### Mô hình tương tác

```
User → Mekong
  Mekong → Buzz (gửi task)
    Buzz → Sophia (logic creative domain)
      Sophia → Providers (AI calls)
      Sophia → Channels (distribution)
    Buzz → Mekong (cập nhật trạng thái)
  Mekong → User (báo cáo tiến độ)
```

### Cấm tạo layer thứ tư

Nếu cần phối hợp across Mekong + Buzz + Sophia → dùng Mekong control plane. Layer thứ tư tạo ra:
- Không rõ ownership task lifecycle
- Báo cáo trạng thái cạnh tranh
- Race condition giữa các orchestration layer

### Trạng thái hiện tại

Sophia hiện hoạt động chưa tích hợp Mekong/Buzz. Khi thêm tích hợp:
1. Creative domain logic của Sophia vẫn ở `seed/ai/` và `tree/`
2. Mekong orchestrate submit task + status
3. Buzz thực thi tự động
4. Không tạo orchestration layer mới

---