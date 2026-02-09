# Sophia AI Video Factory — So Do Luong / UI Flow Diagrams

> Cac so do duoi day mo ta luong di chuyen giua cac man hinh trong Sophia.
> The diagrams below describe navigation flows between screens in Sophia.

---

## 1. Hanh Trinh Nguoi Dung / User Journey Flow

Tu trang chu den video hoan thanh / From landing page to completed video:

```mermaid
flowchart TD
    A["Trang Chu / Landing Page<br/>/"] -->|"Nhan 'Bat Dau'<br/>Click 'Get Started'"| B["Dang Ky / Sign Up"]
    A -->|"Xem Bang Gia<br/>View Pricing"| C["Bang Gia / Pricing<br/>/pricing"]

    B -->|"Tao tai khoan xong<br/>Account created"| D["Thiet Lap / Setup Wizard<br/>/setup-wizard"]

    C -->|"Chon Goi<br/>Choose Plan"| E["Thanh Toan / Polar.sh Checkout"]
    E -->|"Thanh toan xong<br/>Payment done"| D

    D -->|"Hoan thanh 4 buoc<br/>Complete 4 steps"| F["Dashboard<br/>/dashboard"]

    F -->|"Nhan 'Tao Chien Dich'<br/>Click 'New Campaign'"| G["Tao Chien Dich / Create<br/>/dashboard/create"]

    G -->|"Dien thong tin + Nhan 'Tao'<br/>Fill form + Click 'Create'"| H["Dang Xu Ly / Processing<br/>3-5 phut / 3-5 min"]

    H -->|"Hoan thanh<br/>Completed"| I["Chi Tiet / Campaign Detail<br/>/dashboard/campaigns/id"]

    I -->|"Xem + Tai video<br/>View + Download"| J["Video Hoan Thanh<br/>Video Ready"]

    F -->|"Xem tat ca<br/>View all"| K["Danh Sach / Campaigns<br/>/dashboard/campaigns"]
    F -->|"Xem so lieu<br/>View metrics"| L["Thong Ke / Analytics<br/>/dashboard/analytics"]
    F -->|"Doi cai dat<br/>Change settings"| M["Cai Dat / Settings<br/>/dashboard/settings"]

    K -->|"Nhan ten chien dich<br/>Click campaign name"| I
```

---

## 2. Luong Quan Tri / Admin Flow

Luong lam viec cua quan tri vien / Administrator workflow:

```mermaid
flowchart TD
    A["Dang Nhap Admin<br/>Admin Login"] -->|"Xac thuc<br/>Authenticated"| B["Admin Dashboard<br/>/admin"]

    B -->|"Xem tong quan<br/>View overview"| B1["So lieu: Users, Scripts,<br/>Videos, Revenue"]

    B -->|"Quan ly tinh nang<br/>Manage features"| C["Feature Flags<br/>/admin/features"]
    C -->|"Bat/tat tinh nang<br/>Toggle features"| C1["Thay doi theo Tier<br/>Changes by Tier"]

    B -->|"Quan ly affiliate<br/>Manage affiliates"| D["Affiliates<br/>/admin/affiliates"]
    D -->|"Tim kiem chuong trinh<br/>Search programs"| D1["Danh sach chuong trinh<br/>Programs table"]
    D1 -->|"Nhan link<br/>Click link"| D2["Mo trang affiliate<br/>Opens affiliate page"]

    B -->|"Cau hinh he thong<br/>System config"| E["Settings<br/>/admin/settings"]
    E -->|"Ket noi affiliate<br/>Connect affiliates"| F["Integrations<br/>/admin/settings/integrations"]
    F -->|"Nhap API keys<br/>Enter API keys"| F1["ClickBank + ShareASale"]

    E -->|"Hanh dong he thong<br/>System actions"| E1["Clear Cache / Export / Reset"]

    B -->|"Dang xuat<br/>Logout"| G["Trang Chu / Landing<br/>/"]
```

---

## 3. Luong Thiet Lap / Setup Wizard Flow

4 buoc thiet lap ban dau / 4-step initial setup:

```mermaid
flowchart TD
    START["Bat Dau Thiet Lap<br/>Start Setup"] --> S1

    S1["Buoc 1: Kiem Tra He Thong<br/>Step 1: System Check"]
    S1 -->|"He thong OK (xanh)<br/>System OK (green)"| S1OK["Nhan 'Next Step'<br/>Click 'Next Step'"]
    S1 -->|"Co loi (do)<br/>Error (red)"| S1ERR["Kiem tra lai<br/>Check again"]
    S1ERR --> S1

    S1OK --> S2["Buoc 2: Nhap API Keys<br/>Step 2: AI Keys"]

    S2 --> S2A["Nhap OpenRouter Key<br/>Enter OpenRouter Key"]
    S2A -->|"Verify"| S2A1{"Hop le?<br/>Valid?"}
    S2A1 -->|"Xanh / Green"| S2B["Nhap ElevenLabs Key<br/>Enter ElevenLabs Key"]
    S2A1 -->|"Do / Red"| S2A

    S2B -->|"Verify"| S2B1{"Hop le?<br/>Valid?"}
    S2B1 -->|"Xanh / Green"| S2C["Nhap D-ID Key<br/>Enter D-ID Key"]
    S2B1 -->|"Do / Red"| S2B

    S2C -->|"Verify"| S2C1{"Hop le?<br/>Valid?"}
    S2C1 -->|"Xanh / Green"| S2OK["Ca 3 key OK<br/>All 3 keys OK"]
    S2C1 -->|"Do / Red"| S2C

    S2OK -->|"Nhan 'Next Step'"| S3["Buoc 3: Database<br/>Step 3: Airtable"]

    S3 --> S3A["Nhap Airtable Token<br/>Enter Airtable Token"]
    S3A -->|"Verify"| S3A1{"Hop le?<br/>Valid?"}
    S3A1 -->|"OK"| S3B["Nhap Base ID<br/>Enter Base ID"]
    S3A1 -->|"Loi / Error"| S3A

    S3B -->|"Nhan 'Next Step'"| S4["Buoc 4: Hoan Thanh<br/>Step 4: Finish"]

    S4 -->|"Nhan 'Launch Sophia'<br/>Click 'Launch Sophia'"| DONE["Chuyen den Dashboard<br/>Go to Dashboard"]

    S4 -->|"Loi luu / Save error"| S4ERR["Tai file .env.local<br/>Download .env.local"]
```

---

## 4. Luong Tao Chien Dich / Campaign Creation Flow

Tu y tuong den video hoan thanh / From idea to completed video:

```mermaid
flowchart TD
    A["Nhan 'Tao Chien Dich'<br/>Click 'New Campaign'"] --> B["Chon Mau Video<br/>Choose Template"]

    B -->|"Nhan vao mau<br/>Click template"| C["Dien Thong Tin<br/>Fill Details"]

    C --> C1["Ten chien dich<br/>Campaign name"]
    C --> C2["Chu de / Topic"]
    C --> C3["Doi tuong / Audience"]
    C --> C4["Giong noi / Voice"]

    C1 & C2 & C3 & C4 -->|"Nhan 'Tao'<br/>Click 'Create'"| D["Gui Yeu Cau<br/>Submit Request"]

    D --> E["Tao Kich Ban AI<br/>AI Script Generation"]
    E -->|"Inngest job"| F["Tao Giong Noi AI<br/>AI Voice Generation"]
    F -->|"ElevenLabs"| G["Tao Video AI<br/>AI Video Generation"]
    G -->|"HeyGen / D-ID"| H{"Thanh Cong?<br/>Success?"}

    H -->|"Co / Yes"| I["Video Hoan Thanh<br/>Video Completed"]
    I --> J["Xem + Tai Video<br/>View + Download"]

    H -->|"Khong / No"| K["Bao Loi<br/>Error Report"]
    K -->|"Nhan 'Thu Lai'<br/>Click 'Retry'"| E
```

**Thoi gian / Timeline:**

| Buoc / Step | Thoi gian / Duration |
|---|---|
| Dien thong tin / Fill form | 1-2 phut / min |
| Tao kich ban / Script gen | 30 giay / sec |
| Tao giong noi / Voice gen | 30-60 giay / sec |
| Tao video / Video gen | 1-3 phut / min |
| **Tong / Total** | **3-5 phut / min** |

---

## 5. Luong Xac Thuc / Auth Flow

Dang nhap bang Magic Link / Login with Magic Link:

```mermaid
flowchart TD
    A["Trang Dang Nhap<br/>Login Page"] -->|"Nhap email<br/>Enter email"| B["Gui Magic Link<br/>Send Magic Link"]

    B -->|"Kiem tra email<br/>Check your email"| C["Hop Thu / Inbox<br/>Email with link"]

    C -->|"Nhan link trong email<br/>Click link in email"| D{"Link hop le?<br/>Link valid?"}

    D -->|"Co / Yes"| E["Dang Nhap Thanh Cong<br/>Login Successful"]
    E --> F["Chuyen Den Dashboard<br/>Redirect to Dashboard"]

    D -->|"Khong / No (het han)<br/>Expired"| G["Yeu Cau Lai<br/>Request Again"]
    G --> A

    F -->|"Lan dau?<br/>First time?"| H{"Da thiet lap?<br/>Setup done?"}
    H -->|"Chua / No"| I["Chuyen den Setup Wizard<br/>Go to Setup Wizard"]
    H -->|"Roi / Yes"| J["O Lai Dashboard<br/>Stay on Dashboard"]
```

---

## 6. Luong Telegram Bot / Telegram Bot Flow

Tao video tu dien thoai / Create videos from phone:

```mermaid
flowchart TD
    A["Mo Telegram<br/>Open Telegram"] -->|"Tim @Sophia_Bbot<br/>Search @Sophia_Bbot"| B["Nhan START<br/>Tap START"]

    B -->|"/link"| C["Ket Noi Tai Khoan<br/>Connect Account"]
    C -->|"Nhap email xac nhan<br/>Enter + verify email"| D["Tai Khoan Da Ket Noi<br/>Account Connected"]

    D -->|"/campaign"| E["Tao Video Moi<br/>Create New Video"]
    E -->|"Nhap chu de<br/>Enter topic"| F["Dang Xu Ly<br/>Processing..."]

    F -->|"/status"| G["Kiem Tra Tien Trinh<br/>Check Progress"]
    G -->|"Hoan thanh / Done"| H

    F -->|"Xong / Completed"| H["Thong Bao Hoan Thanh<br/>Completion Notification"]

    H -->|"/results"| I["Xem + Tai Video<br/>View + Download Video"]

    D -->|"/stop"| J["Tam Dung Chien Dich<br/>Pause Campaign"]
    J -->|"/start"| K["Tiep Tuc Chien Dich<br/>Resume Campaign"]
    K --> F

    D -->|"/help"| L["Huong Dan Su Dung<br/>Usage Help"]
```

**Cac lenh Telegram / Telegram Commands:**

| Lenh / Command | Chuc nang / Function |
|---|---|
| `/link` | Ket noi tai khoan / Connect account |
| `/campaign` | Tao video moi / Create new video |
| `/status` | Xem tien trinh / Check progress |
| `/results` | Xem ket qua / View results |
| `/start` | Tiep tuc / Resume |
| `/stop` | Tam dung / Pause |
| `/help` | Tro giup / Help |

---

## 7. Tong Quan Ket Noi Trang / Page Connection Overview

Ban do tong the cac trang trong Sophia / Overall map of all pages in Sophia:

```mermaid
flowchart TD
    subgraph PUBLIC["Cong Khai / Public Pages"]
        LP["Trang Chu<br/>Landing /"]
        PR["Bang Gia<br/>Pricing /pricing"]
        AD["Tim San Pham<br/>Affiliate Discovery<br/>/affiliate-discovery"]
    end

    subgraph AUTH["Xac Thuc / Auth"]
        LG["Dang Nhap / Login"]
        SW["Thiet Lap / Setup Wizard<br/>/setup-wizard"]
    end

    subgraph DASHBOARD["Dashboard (Can dang nhap / Requires login)"]
        DB["Tong Quan / Overview<br/>/dashboard"]
        CR["Tao Moi / Create<br/>/dashboard/create"]
        CL["Chien Dich / Campaigns<br/>/dashboard/campaigns"]
        CD["Chi Tiet / Detail<br/>/dashboard/campaigns/id"]
        AN["Thong Ke / Analytics<br/>/dashboard/analytics"]
        ST["Cai Dat / Settings<br/>/dashboard/settings"]
        SH["Suc Khoe / System Health<br/>/dashboard/system-health"]
    end

    subgraph ADMIN["Quan Tri / Admin (Chi admin / Admin only)"]
        AP["Admin Dashboard<br/>/admin"]
        AF["Feature Flags<br/>/admin/features"]
        AA["Affiliates<br/>/admin/affiliates"]
        AS["Settings<br/>/admin/settings"]
        AI["Integrations<br/>/admin/settings/integrations"]
    end

    LP --> LG
    LP --> PR
    PR --> LG
    LG --> SW
    SW --> DB
    LG --> DB

    DB --> CR
    DB --> CL
    DB --> AN
    DB --> ST
    DB --> SH
    CR --> CD
    CL --> CD

    AP --> AF
    AP --> AA
    AP --> AS
    AS --> AI
```

---

## Cach Doc So Do / How to Read These Diagrams

| Ky hieu / Symbol | Y nghia / Meaning |
|---|---|
| Hinh chu nhat / Rectangle | Trang hoac buoc / Page or step |
| Hinh thoi / Diamond | Diem quyet dinh (co/khong) / Decision point (yes/no) |
| Mui ten / Arrow | Huong di chuyen / Navigation direction |
| Chu tren mui ten / Text on arrow | Hanh dong can lam / Action to take |

---

> Cap nhat lan cuoi / Last updated: Thang 2, 2026 / February 2026
