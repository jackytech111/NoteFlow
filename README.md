# NoteFlow

NoteFlow là ứng dụng ghi chú (note-taking) được xây dựng theo kiến trúc **microservices**, gồm các service độc lập giao tiếp qua một API Gateway trung tâm. Dự án được phát triển như một bài tập thực hành xây dựng hệ thống backend theo hướng microservices với Node.js/TypeScript.

## ✨ Features

- ✅ Đăng ký / Đăng nhập
- ✅ JWT Authentication (access token + refresh token)
- ✅ Refresh Token Rotation (thu hồi & cấp mới token sau mỗi lần refresh)
- ✅ Quản lý hồ sơ người dùng (User Profile)
- ✅ CRUD Notes
- ✅ CRUD Tags
- ✅ Soft Delete & Restore Note
- ✅ Lọc Notes theo Tag
- ✅ Swagger / OpenAPI Documentation
- ✅ Unit Tests (Jest)

> 🔜 Search & Pagination cho Notes chưa xác nhận đã implement đầy đủ — xem mục [Roadmap](#-roadmap).

## 🛠️ Tech Stack

| Layer                                                                                               | Technology            |
| --------------------------------------------------------------------------------------------------- | --------------------- |
| ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)      | Ngôn ngữ chính        |
| ![Node.js](https://img.shields.io/badge/-Node.js-339933?logo=node.js&logoColor=white)               | Runtime               |
| ![Express](https://img.shields.io/badge/-Express%205-000000?logo=express&logoColor=white)           | Web framework         |
| ![Prisma](https://img.shields.io/badge/-Prisma%206-2D3748?logo=prisma&logoColor=white)              | ORM                   |
| ![PostgreSQL](https://img.shields.io/badge/-PostgreSQL%2017-4169E1?logo=postgresql&logoColor=white) | Database              |
| ![JWT](https://img.shields.io/badge/-JWT-000000?logo=jsonwebtokens&logoColor=white)                 | Authentication        |
| ![Jest](https://img.shields.io/badge/-Jest-C21325?logo=jest&logoColor=white)                        | Testing               |
| ![Docker](https://img.shields.io/badge/-Docker-2496ED?logo=docker&logoColor=white)                  | Containerization (DB) |
| ![Swagger](https://img.shields.io/badge/-Swagger-85EA2D?logo=swagger&logoColor=black)               | API Docs              |

## 🤔 Why Microservices?

- **Service isolation** — lỗi hoặc sự cố ở 1 service (VD: note-service) không làm sập toàn bộ hệ thống auth
- **Database per service** — mỗi service sở hữu schema riêng, tránh coupling qua tầng dữ liệu, dễ đổi schema độc lập
- **Independent deployment** — có thể deploy/scale riêng từng service theo tải thực tế (VD: note-service chịu tải cao hơn auth-service)
- **Separation of concerns** — mỗi service chỉ lo đúng 1 domain nghiệp vụ, dễ maintain và test độc lập
- **API Gateway làm điểm vào duy nhất** — ẩn chi tiết hạ tầng nội bộ khỏi client, tập trung xử lý cross-cutting concern (CORS, auth) ở 1 chỗ

## 🏗️ Architecture

```mermaid
graph TD
    Client([Client])
    Gateway[API Gateway<br/>:8080]
    Auth[Auth Service<br/>:3001]
    User[User Service<br/>:3002]
    Note[Note Service<br/>:3003]
    Tag[Tag Service<br/>:3004]
    AuthDB[(noteflow_auth)]
    UserDB[(noteflow_users)]
    NoteDB[(noteflow_notes)]
    TagDB[(noteflow_tags)]

    Client -->|HTTP| Gateway
    Gateway -->|proxy /auth/*| Auth
    Gateway -->|proxy /profile| User
    Gateway -->|proxy /notes/*| Note
    Gateway -->|proxy /tags/*| Tag

    Note -.->|validate token| Auth
    Tag -.->|validate token| Auth
    User -.->|validate token| Auth

    Auth --> AuthDB
    User --> UserDB
    Note --> NoteDB
    Tag --> TagDB
```

Mỗi service có database riêng biệt trên cùng 1 PostgreSQL instance (port `5433` khi chạy local), khởi tạo qua `init-database.sql`. Không có foreign key thật giữa các database khác nhau — các tham chiếu như `userId` trong `Note`/`Tag` là **logical reference**, được đảm bảo tính đúng đắn ở tầng application chứ không phải DB constraint.

## 🗄️ Database Schema (ERD)

**Auth Service**

```mermaid
erDiagram
    USERS ||--o{ REFRESH_TOKENS : has
    USERS {
        string id PK
        string email UK
        string password
        datetime created_at
        datetime updated_at
    }
    REFRESH_TOKENS {
        string id PK
        string user_id FK
        string token UK
        datetime expires_at
        datetime created_at
    }
```

**User Service**

```mermaid
erDiagram
    USER_PROFILES {
        string id PK
        string user_id UK "logical ref -> auth-service.users.id"
        string first_name
        string last_name
        string bio
        string avatar_url
        json preferences
        datetime created_at
        datetime updated_at
    }
```

**Note Service**

```mermaid
erDiagram
    NOTES ||--o{ NOTE_TAGS : has

    NOTES {
        string id PK
        string user_id
        string title
        text content
        boolean is_deleted
        datetime created_at
        datetime updated_at
    }

    NOTE_TAGS {
        string note_id PK
        string tag_id PK
    }
```

> **Note**
>
> - `user_id` stores the User ID from the Auth Service.
> - `tag_id` stores the Tag ID from the Tag Service.
> - Since NoteFlow follows a microservices architecture, these are **logical references** rather than database foreign keys.

**Tag Service**

```mermaid
erDiagram
    TAGS {
        string id PK
        string name
        string color
        string user_id "logical ref -> auth-service.users.id"
        datetime created_at
        datetime updated_at
    }
```

## 🔄 API Flows

**Login Flow**

```mermaid
sequenceDiagram
    participant C as Client
    participant G as API Gateway
    participant A as Auth Service
    participant DB as Auth DB

    C->>G: POST /auth/login (email, password)
    G->>A: forward request
    A->>DB: findUnique(email)
    DB-->>A: user record
    A->>A: bcrypt.compare(password)
    A->>DB: deleteMany + create (rotate refresh token)
    A-->>G: { accessToken, refreshToken }
    G-->>C: 200 OK
```

**Create Note Flow**

```mermaid
sequenceDiagram
    participant C as Client
    participant G as API Gateway
    participant A as Auth Service
    participant N as Note Service
    participant DB as Notes DB

    C->>G: POST /notes (Bearer token, title, content, tagIds)
    G->>A: validate token
    A-->>G: userId, email
    G->>N: forward request + user context
    N->>DB: INSERT note + note_tags
    DB-->>N: created note
    N-->>G: 201 Created
    G-->>C: 201 Created
```

> Cơ chế xác thực trong `gatewayAuth` (Gateway có tự verify JWT hay gọi `/auth/validate` của auth-service) được suy ra từ tên route và comment trong code, chưa được xác nhận trực tiếp từ file middleware — cập nhật lại diagram này nếu khác thực tế.

## 📦 Cấu trúc thư mục

```
NoteFlow/
├── api-gateway/            # Entry point duy nhất, reverse proxy tới services
│   ├── src/
│   ├── docs/
│   │   └── openapi.json    # OpenAPI spec, phục vụ Swagger UI
│   └── package.json
├── services/
│   ├── auth-service/       # Đăng ký, đăng nhập, JWT, refresh/logout/validate — :3001
│   ├── user-service/       # Quản lý hồ sơ người dùng — :3002
│   ├── note-service/       # CRUD ghi chú — :3003
│   └── tag-service/        # CRUD nhãn — :3004
├── shared/                  # Types, utils, middleware dùng chung
├── init-database.sql        # Khởi tạo các DB riêng cho từng service (local)
├── docker-compose.yml        # PostgreSQL + toàn bộ services (local dev)
├── render.yaml               # Render Blueprint (production deploy)
└── README.md
```

## 🚀 Bắt đầu

### Yêu cầu môi trường

- Node.js LTS gần đây (khuyến nghị 20+)
- Docker & Docker Compose
- npm

### Cài đặt

```bash
git clone <repo-url>
cd NoteFlow

cd api-gateway && npm install && cd ..
cd services/auth-service && npm install && cd ../..
cd services/user-service && npm install && cd ../..
cd services/note-service && npm install && cd ../..
cd services/tag-service && npm install && cd ../..
```

### Biến môi trường

Mỗi service (`api-gateway`, `services/auth-service`, `services/user-service`, `services/note-service`, `services/tag-service`) có file `.env.example` riêng. Copy và chỉnh giá trị cần thiết:

```bash
cp .env.example .env
# sau đó chỉnh sửa các giá trị (DATABASE_URL, JWT_SECRET, PORT, ...)
```

> `JWT_SECRET`/`JWT_REFRESH_SECRET` phải **giống nhau** giữa `auth-service` và các service khác cần validate token.

> ⚠️ Không commit file `.env`/`.env.docker` chứa giá trị thật lên Git. Nếu secret từng bị lộ (ví dụ dán vào chat, log, hay commit nhầm), phải **rotate lại ngay** (đổi `JWT_SECRET` và database password) trên tất cả nơi liên quan.

### Chạy Database

```bash
docker compose up -d postgres
```

`init-database.sql` tự động tạo 4 database riêng (`noteflow_auth`, `noteflow_users`, `noteflow_notes`, `noteflow_tags`) khi container khởi tạo lần đầu.

### Migrate database

```bash
cd services/auth-service && npx prisma migrate deploy && cd ../..
cd services/user-service && npx prisma migrate deploy && cd ../..
cd services/note-service && npx prisma migrate deploy && cd ../..
cd services/tag-service && npx prisma migrate deploy && cd ../..
```

### Chạy từng service (mỗi service 1 terminal riêng)

```bash
cd services/auth-service && npm run dev
cd services/user-service && npm run dev
cd services/note-service && npm run dev
cd services/tag-service && npm run dev
cd api-gateway && npm run dev
```

Gateway chạy tại: `http://localhost:8080`

### Chạy toàn bộ bằng Docker Compose (khuyến nghị cho test local)

```bash
docker compose up --build
```

Khởi động cả 4 service + `api-gateway` + Postgres trong 1 mạng nội bộ Docker, gateway gọi các service qua tên service (`http://auth-service:3001`, ...).

## 📖 API Documentation

```
http://localhost:8080/api-docs
```

Nhóm endpoint chính: **Authentication Flow**, **User Flow**, **Notes Flow**, **Tags Flow**. Có thể test trực tiếp bằng nút **Authorize** (Bearer token) + **Try it out**, không cần Postman.

## 🧪 Testing

```bash
cd services/auth-service
npm test
```

Test hiện tại (unit test, mock toàn bộ dependency ngoài — bcrypt, jsonwebtoken, Prisma) bao phủ `AuthService`:

- Đăng ký / đăng nhập: thành công & các trường hợp lỗi
- Refresh token: rotation thành công, token hết hạn, token không còn tồn tại trong DB (bảo vệ trước race-condition khi refresh token đã bị rotate)

Mỗi service khác (`user-service`, `notes-service`, `tags-service`) cũng có bộ Jest test riêng, chạy tương tự (`npm test` trong thư mục service đó).

## 📸 Screenshots

> Swagger UI

![Swagger UI](api-gateway/docs/images/SwaggerHome.png)

> Unit Test

![Unit Test Auth Service](api-gateway/docs/images/AuthTest.png)

![Unit Test User Service](api-gateway/docs/images/UserTest.png)

## 🐳 Deploy

### Render (đang dùng cho production)

Toàn bộ hệ thống được deploy qua [Render](https://render.com) bằng **Blueprint** (`render.yaml`) — mỗi service là 1 Web Service riêng, cùng 1 Render workspace.

**Database:** dùng [Neon](https://neon.tech) (Postgres serverless), 1 project chứa 4 database riêng biệt (`noteflow_auth`, `noteflow_users`, `noteflow_notes`, `noteflow_tags`), tương tự cấu trúc local nhưng khác host.

#### ⚠️ Giới hạn quan trọng của Free tier trên Render

> Free web service trên Render **có thể gửi** request qua private network, nhưng **không thể nhận**. Vì vậy các service backend (`auth`, `user`, `notes`, `tags`) không nhận được request nội bộ nếu gateway gọi qua hostname private.

Do đó, `api-gateway` gọi sang các service khác qua **public URL** (`https://noteflow-<service>.onrender.com`), không dùng hostname nội bộ kiểu Docker Compose. Nếu nâng cấp lên gói trả phí, có thể chuyển sang dùng `fromService` + `property: hostport` trong `render.yaml` để giao tiếp qua private network, nhanh hơn và không tính bandwidth.

Hệ quả khác của free tier: mỗi service tự "ngủ" sau một khoảng thời gian không có request, khiến lần gọi đầu tiên có thể chậm hơn 50 giây (cold start) — đây là giới hạn cố hữu của nền tảng, không phải lỗi ứng dụng.

#### Các biến môi trường phải điền TAY sau khi deploy Blueprint

`render.yaml` khai báo các biến sau với `sync: false` — nghĩa là Render tạo sẵn tên biến nhưng **không tự điền giá trị**. Sau mỗi lần tạo mới service (hoặc deploy lại từ đầu), phải vào tab **Environment** của **từng service** trên Render Dashboard để nhập tay, rồi bấm **Save Changes**:

| Biến                 | Service cần set                                               | Lưu ý                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JWT_SECRET`         | **Cả 5 service** (`auth`, `user`, `notes`, `tags`, `gateway`) | Phải **giống hệt nhau tuyệt đối** ở tất cả service — đây là cơ chế các service khác verify được token do `auth-service` ký ra. Thiếu ở bất kỳ service nào sẽ gây lỗi `"Server configuration error"`. |
| `JWT_REFRESH_SECRET` | Chỉ `auth-service`                                            |                                                                                                                                                                                                      |
| `DATABASE_URL`       | 4 service backend (`auth`, `user`, `notes`, `tags`)           | Mỗi service dùng **connection string khác nhau**, chỉ khác tên database ở cuối URL (`noteflow_auth`, `noteflow_users`, `noteflow_notes`, `noteflow_tags`). Lấy từ Neon Console → Connection Details. |
| `CORS_ORIGIN`        | Tất cả service                                                | Trỏ về domain frontend thật khi có, tạm thời có thể để `*` hoặc domain dev khi test.                                                                                                                 |

**Dấu hiệu nhận biết thiếu biến nào:**

- Thiếu `JWT_SECRET` → response trả `"Server configuration error"` (từ gateway) hoặc lỗi tương tự ở service con.
- Thiếu/sai `DATABASE_URL` → lỗi trả nguyên văn từ Prisma, dạng `"Environment variable not found: DATABASE_URL"` hoặc `"Invalid ... invocation"`.

#### Checklist khi deploy lại từ đầu (ví dụ tạo Render account mới, hoặc xóa hết service cũ)

1. Tạo 4 database trên Neon: `noteflow_auth`, `noteflow_users`, `noteflow_notes`, `noteflow_tags` (cùng 1 project, chung host/user/password, khác tên DB).
2. Push `render.yaml` lên nhánh `main` → Render tự tạo 5 service qua Blueprint.
3. Vào từng service, điền tay `JWT_SECRET` (giống nhau ở cả 5), `DATABASE_URL` (khác nhau ở 4 service backend), `CORS_ORIGIN`.
4. Đảm bảo Dockerfile/migrate chạy `npx prisma migrate deploy` trước khi service start, để tạo bảng trong database mới (database trống sẽ gây lỗi `relation does not exist`).
5. Test lại theo thứ tự: `auth` (register/login) → `user` (profile) → `tags` → `notes`, qua `api-gateway`, không gọi thẳng từng service.

### Railway (phương án thay thế, chưa triển khai)

Có thể deploy lên [Railway](https://railway.com) — mỗi service là 1 Railway service riêng trong cùng project, chỉ `api-gateway` bật Public Networking, các service còn lại giữ private, giao tiếp qua mạng nội bộ Railway (Railway không có giới hạn free-tier-chặn-nhận-private-traffic giống Render, cần xác nhận lại nếu chọn hướng này).

## 🗺️ Roadmap

- [x] JWT Authentication + Refresh Rotation
- [x] CRUD Notes / Tags
- [x] Swagger / OpenAPI
- [x] Unit Test
- [x] Pagination
- [x] Deploy production (Render + Neon)
- [ ] Search Notes
- [ ] Integration Test
- [ ] Redis Cache
- [x] Docker hóa toàn bộ services
- [ ] CI/CD (GitHub Actions)

## 🔮 Future Improvements

- Redis cho caching / session store
- Message queue (RabbitMQ) cho giao tiếp bất đồng bộ giữa service
- Distributed tracing (VD: OpenTelemetry) để debug request xuyên nhiều service
- Monitoring: Prometheus + Grafana
- Chuyển gateway ↔ services sang private network khi nâng cấp Render lên gói trả phí

## 📄 License

MIT
