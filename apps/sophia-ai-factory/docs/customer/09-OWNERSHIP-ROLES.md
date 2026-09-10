# 👥 Team Roles, Permissions & Ownership Transfer Guide
# Hướng Dẫn Phân Quyền Nhóm & Chuyển Giao Quyền Sở Hữu Dành Cho CEO

> **Target Audience / Đối Tượng:** Non-Technical Founders, CEOs & Operations Managers / Nhà Sáng Lập, Giám Đốc Điều Hành & Trưởng Bộ Phận Vận Hành  
> **Topic / Chủ Đề:** Inviting Co-Founders, Delegating to Video Editors & Studio Transfer / Thêm Thành Viên, Phân Quyền Biên Tập Viên & Chuyển Nhượng Doanh Nghiệp  
> **Team Management Route / Đường Dẫn:** `https://sophia.agencyos.network/settings`

---

## 🏛️ Executive Summary: Collaborative Studio Governance
## Tổng Quan: Quản Trị Studio Chuyên Nghiệp & Phân Quyền An Toàn

**English 🇬🇧:**  
As your media business scales, you shouldn't have to share your personal login credentials or give junior video editors access to your company credit card or sensitive AI API keys. Sophia AI Factory provides an enterprise-grade, role-based access control system designed specifically for creative agencies and multi-channel publishing teams.

**Tiếng Việt 🇻🇳:**  
Khi doanh nghiệp truyền thông của bạn mở rộng quy mô, bạn không bao giờ nên dùng chung tài khoản đăng nhập cá nhân, và càng không nên để nhân viên biên tập video tiếp cận thông tin thẻ thanh toán hay mã khóa API bảo mật của công ty. Sophia AI Factory cung cấp hệ thống phân quyền chuyên nghiệp giúp bạn phân định ranh giới công việc rõ ràng, an toàn tuyệt đối.

---

## 🎭 The 3 Team Roles Explained
## Ma Trận Phân Quyền 3 Cấp Độ Trong Workspace

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PERMISSIONS HIERARCHY                              │
│                                                                             │
│   👑 OWNER (Chủ Sở Hữu)                                                     │
│      ├── Manage Subscriptions, Billing & Payment Methods                     │
│      ├── Input, View Masked & Rotate Sensitive AI API Keys                  │
│      ├── Invite & Remove Team Members, Assign Roles                         │
│      └── Transfer or Delete the Studio Workspace                            │
│                                                                             │
│   🎬 EDITOR (Biên Tập Viên / Trưởng Nhóm Nội Dung)                          │
│      ├── Create New Missions & Select Video Templates                       │
│      ├── Review Scripts, Tweak Hooks & Modify Visual Styles                 │
│      ├── Approve Video Compositing & Trigger Renders                        │
│      └── Cannot view billing, credit cards, or raw API keys                 │
│                                                                             │
│   👁️ VIEWER (Người Xem / Khách Hàng Kiểm Duyệt)                             │
│      ├── Stream Completed Videos & Download Full HD MP4s                    │
│      ├── View Campaign Analytics & Social Performance                       │
│      └── Cannot launch missions, edit scripts, or touch settings            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Comprehensive Role Comparison Table
## Bảng So Sánh Quyền Hạn Chi Tiết

**English 🇬🇧 & Tiếng Việt 🇻🇳:**

| Feature / Quyền Hạn | 👑 OWNER (Chủ Sở Hữu) | 🎬 EDITOR (Biên Tập) | 👁️ VIEWER (Người Xem) |
|---|:---:|:---:|:---:|
| **Create & Launch Missions (Tạo & chạy video)** | ✅ Full Access | ✅ Full Access | ❌ No Access |
| **Review & Edit Video Scripts (Duyệt kịch bản)** | ✅ Full Access | ✅ Full Access | ❌ No Access |
| **Download Rendered MP4 Files (Tải video)** | ✅ Full Access | ✅ Full Access | ✅ Full Access |
| **View Analytics & Dashboards (Xem báo cáo)** | ✅ Full Access | ✅ Full Access | ✅ Full Access |
| **Connect & Rotate API Keys (Quản lý khóa API)** | ✅ Full Access | ❌ Hidden & Locked | ❌ Hidden & Locked |
| **Manage Billing & MCU Top-ups (Nạp tiền & gói)** | ✅ Full Access | ❌ Hidden & Locked | ❌ Hidden & Locked |
| **Invite & Remove Team Members (Thêm/xóa người)** | ✅ Full Access | ❌ No Access | ❌ No Access |
| **Transfer Studio Ownership (Chuyển nhượng)** | ✅ Exclusive | ❌ No Access | ❌ No Access |

---

## ✉️ How to Invite a Team Member (Step-by-Step)
## Hướng Dẫn Thêm Thành Viên Mới Vào Nhóm

**English 🇬🇧:**
1. Log into your dashboard as the **OWNER** and navigate to `/settings`.
2. Scroll down to the **"Team Members & Collaboration"** section.
3. Click the **"Invite Member"** button.
4. Enter your colleague's email address (e.g., `editor@yourcompany.com`).
5. Choose their role from the dropdown:
   - Select **`EDITOR`** for creative staff who need to create and review videos.
   - Select **`VIEWER`** for external clients, investors, or compliance reviewers.
6. Click **"Send Invitation"**.
7. Your team member will receive an invitation link via email. Once they set their password, they will instantly gain access to your shared studio workspace!

**Tiếng Việt 🇻🇳:**
1. Đăng nhập vào tài khoản với vai trò **CHỦ SỞ HỮU (OWNER)** và vào mục `/settings`.
2. Kéo xuống phần **"Thành Viên Nhóm & Phân Quyền"**.
3. Nhấn nút **"Thêm Thành Viên Mới"**.
4. Nhập địa chỉ email của nhân sự (ví dụ: `editor@congty.com`).
5. Chọn cấp độ phân quyền tương ứng từ danh sách:
   - Chọn **`EDITOR`** cho biên tập viên, nhân viên sáng tạo nội dung trực tiếp.
   - Chọn **`VIEWER`** cho khách hàng đối tác, nhà đầu tư muốn duyệt sản phẩm hoàn thiện.
6. Nhấn nút **"Gửi Lời Mời"**.
7. Thành viên sẽ nhận được email kích hoạt. Sau khi tạo mật khẩu, họ sẽ lập tức truy cập vào đúng không gian làm việc của công ty bạn!

---

## 🚫 How to Revoke or Downgrade Access Instantly
## Cách Hủy Quyền Hoặc Đổi Vai Trò Ngay Lập Tức

**English 🇬🇧:**
When an employee or external contractor leaves your organization:
1. Navigate to `/settings` ➔ **"Team Members"**.
2. Locate the team member in the active roster.
3. To change their role, click the dropdown next to their name and select the new role.
4. To remove them entirely, click the **"Revoke Access"** (trash can) button and confirm.
5. Their session is terminated immediately; they will no longer have access to your studio, videos, or scripts.

**Tiếng Việt 🇻🇳:**
Khi một nhân sự hoặc cộng tác viên ngừng làm việc tại doanh nghiệp của bạn:
1. Truy cập vào `/settings` ➔ Mục **"Thành Viên Nhóm"**.
2. Tìm tên hoặc email của nhân sự trong danh sách đang hoạt động.
3. Để đổi quyền, chỉ cần nhấp vào ô chọn vai trò bên cạnh tên họ và chọn quyền mới.
4. Để xóa hoàn toàn, nhấn vào biểu tượng **"Thu Hồi Quyền Truy Cập"** và bấm xác nhận.
5. Phiên đăng nhập của họ sẽ bị khóa ngay lập tức; họ không còn quyền xem hay tải bất kỳ nội dung nào của studio.

---

## 🤝 How to Transfer Workspace Ownership (M&A / Founder Exit)
## Hướng Dẫn Chuyển Giao Quyền Sở Hữu (Bán Kênh Hoặc Chuyển Giao)

**English 🇬🇧:**
If you are selling your media brand, transferring the business to a co-founder, or restructuring your corporate holdings:
1. **Prerequisite:** The new owner must already be invited as an active team member.
2. In `/settings` under "Account Administration", find the **"Transfer Ownership"** section.
3. Select the verified email of the incoming owner from the list.
4. Review the transfer terms:
   - The recipient will inherit full billing authority and ownership of all video assets.
   - Your account will automatically transition to an **`EDITOR`** or **`VIEWER`** role (or you can exit entirely).
5. Click **"Initiate Ownership Transfer"**.
6. A security confirmation email with a one-time verification link is dispatched to your registered email address.
7. Once confirmed, ownership is transferred permanently and logged in the organization audit trail.

**Tiếng Việt 🇻🇳:**
Nếu bạn bán lại kênh truyền thông, chuyển giao công ty cho đối tác hoặc tái cấu trúc doanh nghiệp:
1. **Điều Kiện Cần:** Người nhận chuyển giao phải được thêm vào nhóm với tư cách thành viên trước đó.
2. Tại mục `/settings` > "Quản Trị Tài Khoản", tìm phần **"Chuyển Giao Quyền Sở Hữu"**.
3. Chọn địa chỉ email của người nhận từ danh sách thành viên.
4. Đọc kỹ các điều khoản bàn giao:
   - Người nhận mới sẽ nắm toàn quyền thanh toán, quản lý gói dịch vụ và toàn bộ tài sản video.
   - Tài khoản của bạn sẽ tự động chuyển thành vai trò **`EDITOR`** hoặc bạn có thể rời khỏi studio hoàn toàn.
5. Nhấn **"Bắt Đầu Chuyển Giao Quyền Sở Hữu"**.
6. Hệ thống sẽ gửi một email xác thực bảo mật tới địa chỉ email của bạn kèm đường dẫn xác nhận.
7. Khi bạn nhấn xác nhận, quyền sở hữu sẽ được chuyển giao vĩnh viễn và được lưu vào nhật ký kiểm toán minh bạch của hệ thống.
