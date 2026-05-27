# 골프 안내 페이지 생성 서비스 계획

359_sehyun 레퍼런스(`https://github.com/jadely5050/359_sehyun`)와 동일한 행사 안내 페이지를 사용자 입력 기반으로 생성/렌더링하는 기능을 추가한다.

- `/generate` — 입력 폼 (행사 정보 + 야디지 18장 + 그린 18장)
- `/go/[slug]` — 359_sehyun의 `app/page.js`와 동일한 형태의 안내 페이지
- `/go/[slug]/record` — 359_sehyun의 `app/record/page.js` 야디지/그린 뷰어

이미지 저장소는 기존 R2(`/api/upload`)를 그대로 쓰고, DB는 기존 Neon/`@vercel/postgres` 인스턴스에 새 테이블 한 개만 추가한다.

## 확정된 결정 사항

| 항목 | 결정 |
|---|---|
| 슬러그 문자 정책 | **한글 허용** (URL은 인코딩되어 노출됨) |
| 슬러그 중복 시 | **덮어쓰기** (현재 단계, 인증 도입 전 임시) |
| 인증/권한 | **아직 없음** (누구나 `/generate` 접근 가능) |
| 야디지 티 종류 | **1세트 (white만)** — 티 토글 UI 제거 |
| 홀별 공략 텍스트 | **이번 작업에서 제외**, 추후 추가 |
| R2 버킷 | **공개** — `R2_PUBLIC_URL` 직링 사용 |

R2 공개 관련 메모: 공개 버킷이면 모바일/외부 어디서든 `<img src="https://...r2.dev/events/{slug}/yardage/h1.jpg">` 형태로 바로 렌더링된다. 비공개 + `/api/image` 프록시도 가능하지만 매 요청이 서버를 거치고 캐싱·동시 요청에 부담이 있다. 현재 [app/api/upload/route.js](app/api/upload/route.js)가 이미 `R2_PUBLIC_URL/${key}`를 반환하고 있어 그대로 사용 가능.

---

## 1. 현재 프로젝트에서 재사용할 것

- **R2 업로드**: [app/api/upload/route.js](app/api/upload/route.js) — `formData(file, fileName, path)` 받아 `${path}/${fileName}` 로 PutObject 후 `R2_PUBLIC_URL/key` 반환. 그대로 사용.
- **DB 접속**: `@vercel/postgres`의 `sql` 태그드 템플릿. [app/api/courses/route.js](app/api/courses/route.js), [app/api/rounds/route.js](app/api/rounds/route.js)와 동일한 패턴.
- **이미지 압축**: [app/utils/imageCompression.js](app/utils/imageCompression.js) — 업로드 전 클라이언트 압축에 재사용.

레퍼런스에서 가져와 이식할 것:
- `app/page.js` — 행사 안내 홈(탭, 일정, 조편성, 시상, 중식 카드, 공지 모달, 지도 버튼). 하드코딩된 문구를 `props`로 받게 일반화한다.
- `app/record/page.js` + `YardageDrawingBoard.js` — 야디지/그린 뷰어. **티 토글 제거**, 그 외 18홀, 홀 점프, 그린 모달, 튜토리얼은 유지. 공략 모달은 데이터가 없으므로 1차 작업에서 숨김.
- `app/globals.css` — `--accent-neon`, `.info-card`, `.modal-overlay` 등 클래스. 현재 프로젝트 `globals.css`와 충돌 없는지 비교 후 머지.

---

## 2. 데이터 모델

새 테이블 1개를 `@vercel/postgres`로 생성한다.

```sql
CREATE TABLE IF NOT EXISTS event_pages (
  slug          TEXT PRIMARY KEY,             -- /go/[slug] URL의 슬러그 ("홈페이지이름", 한글 가능)
  title         TEXT NOT NULL,                -- 페이지 상단 큰 타이틀
  subtitle      TEXT,                         -- 작은 부제
  event_date    DATE,                         -- 행사 일자
  course_name   TEXT,                         -- 골프장명
  course_address TEXT,
  course_phone  TEXT,
  course_distance_note TEXT,                  -- "여의도 기준 약 1h 35m" 같은 보조 문구
  map_links     JSONB,                        -- { naver, kakao, tmap }
  schedule      JSONB,                        -- [{time:"07:25", text:"집합 및 기념 사진"}]
  groups        JSONB,                        -- [{course:"밸리", time:"07:59", players:"...", start:"valley"}]
  award_text    TEXT,                         -- 시상/정산 자유 텍스트
  settlement_text TEXT,
  lunch         JSONB,                        -- null이면 미입력. 있을 때: { name, address, phone, menu, map_links:{naver,kakao} }
  notice        JSONB,                        -- { enabled, emoji, title, body }
  par_info      INTEGER[],                    -- 18홀 파 (기본값 프리셋 + 편집)
  yardage_images JSONB,                       -- [{hole:1, url, key}, ...] (18개, white만)
  green_images   JSONB,                       -- [{hole:1, url, key}, ...] (18개)
  -- hole_strategies JSONB                    -- (추후 컬럼 추가 예정, 이번 마이그레이션엔 미포함)
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

설계 메모:
- 기존 `golf_courses` 테이블은 행사용 메타데이터를 담기엔 부족 → 별도 테이블 분리.
- 가변 섹션(`schedule`/`groups`/`lunch`/`notice`)은 모두 JSONB.
- **슬러그 한글**: PostgreSQL TEXT PK는 UTF-8이라 한글이 그대로 PK로 동작. 단 클라이언트→서버 라우팅에서 `encodeURIComponent` 처리 필수 (`Link href` 사용 시 Next.js가 자동 인코딩).
- 슬러그 검증 정규식 예: `/^[\p{L}\p{N}_\-]{2,40}$/u` (한글/영문/숫자/언더바/하이픈 2~40자). 공백·`/`·`?`·`#` 같은 URL 특수문자는 거부.
- 추후 인증 도입 시 `owner_token` 또는 `owner_id` 컬럼 추가 예정.
- `hole_strategies` 컬럼은 추후 추가할 때 `ALTER TABLE event_pages ADD COLUMN IF NOT EXISTS hole_strategies JSONB;` 로 무중단 확장 가능.

---

## 3. R2 저장 경로 규약

```
events/{slug}/yardage/h{1..18}.jpg
events/{slug}/green/g{1..18}.jpg
```

`/api/upload`에 `path=events/{slug}/yardage`, `fileName=h1.jpg` 형태로 보내면 그대로 동작. 같은 슬러그에 재업로드 시 R2 PUT이 덮어쓴다 (멱등).

슬러그가 한글이어도 R2 키는 UTF-8 그대로 허용되지만, URL에 노출될 때는 인코딩됨. 키 자체에 한글이 들어가는 게 거슬리면 슬러그를 hash/uuid로 매핑하는 옵션도 있으나, 일단 그대로 사용.

---

## 4. 새 API 라우트

### `POST /api/events` (생성/덮어쓰기)
- Body: `event_pages`의 모든 컬럼 (이미지는 url/key가 채워진 상태)
- **충돌 정책**: `ON CONFLICT (slug) DO UPDATE SET ...` — 슬러그가 같으면 모든 필드를 새 값으로 덮어쓰고 `updated_at = NOW()`.
- `initDB()` 패턴은 기존 routes와 동일하게 첫 호출에 테이블 생성.

### `GET /api/events/[slug]`
- `event_pages` 단건 반환. 없으면 404.
- 폼에서 슬러그 가용성 확인용으로도 사용 (없으면 신규, 있으면 "기존 페이지 덮어쓰기" 경고 표시).

### `DELETE /api/events/[slug]` (선택)
- 1차 작업 범위 외.

### 기존 재사용
- `POST /api/upload` — 그대로
- `GET /api/image` — 사용하지 않음 (공개 버킷 직링)

---

## 5. `/generate` 폼 설계

레퍼런스의 모든 섹션을 입력 가능하도록 한다. 섹션별 접기/펴기 UI로 화면 길이 부담을 줄인다.

### 5.1 기본 정보
- `slug` (홈페이지 이름) — 필수, 한글 가능, 디바운스로 가용성 체크 + URL 미리보기 (`/go/{slug}`)
  - 이미 존재할 경우: "이 슬러그는 이미 사용 중입니다. 제출 시 기존 페이지가 **덮어써집니다**." 안내
- `title`, `subtitle`, `event_date`
- `par_info[18]` — 기본값 프리셋 + 직접 편집 가능

### 5.2 골프장
- `course_name`, `course_address`, `course_phone`, `course_distance_note`
- `map_links.naver`, `map_links.kakao`, `map_links.tmap` (선택)

### 5.3 일정 (동적 행)
- 행 추가/삭제. 각 행: `time`, `text`

### 5.4 조편성 (동적 행)
- 각 행: `course` (밸리/레이크 등 자유 텍스트), `time`, `players`, `start` (valley|lake|기타)

### 5.5 시상/정산
- `award_text`, `settlement_text` — 멀티라인 textarea

### 5.6 중식 (선택, 체크박스 토글)
- `lunch.enabled` (체크박스) — 체크하지 않으면 아래 입력 필드 비활성화/숨김 처리하고 DB에는 `null` 저장
- 체크 시 입력 필드: `lunch.name`, `lunch.address`, `lunch.phone`, `lunch.menu`
- `lunch.map_links.naver`, `lunch.map_links.kakao`

### 5.7 공지 팝업 (선택)
- `notice.enabled` (체크박스)
- `notice.emoji`, `notice.title`, `notice.body`

### 5.8 야디지 이미지 (필수, white 1세트)
- 1~18홀 슬롯. 각 슬롯에 파일 선택 + 미리보기 + 재선택.
- 다중 파일 드래그&드롭으로 한번에 18장 자동 매핑 (파일명 정렬 기반).
- 18장 모두 채우기 전에는 제출 불가.

### 5.9 그린 이미지 (필수)
- 야디지와 동일한 UX.

### 5.10 ~~홀별 공략~~ → 이번 작업 제외
- 추후 작업에서 textarea 18개로 추가 예정. 컬럼 스키마만 확장 가능하게 비워둠.

### 5.11 제출 ("안내페이지 생성")
- 단계 표시: ① 슬러그 검증/덮어쓰기 안내 → ② 이미지 압축 → ③ R2 업로드 (진행률 12/36) → ④ 메타 저장 → ⑤ `/go/{slug}` 리다이렉트

---

## 6. 제출 흐름 상세

```
[클라이언트]
1. 폼 입력 완료 → "안내페이지 생성" 클릭
2. GET /api/events/{slug}
   - 200 (존재): "덮어쓰기 됩니다" 확정 다이얼로그
   - 404: 신규 생성
3. 야디지/그린 36장 → utils/imageCompression.js 압축
4. 동시성 3~5개로 POST /api/upload 36회
   - path=events/{slug}/yardage, fileName=h{n}.jpg
   - path=events/{slug}/green,   fileName=g{n}.jpg
   - 결과 {url, key} 수집, 실패 시 재시도 1회
5. POST /api/events (body = 폼 데이터 + yardage_images/green_images 배열)
   - 서버는 ON CONFLICT DO UPDATE 로 덮어쓰기
6. 응답 200 → router.push(`/go/${encodeURIComponent(slug)}`)
```

---

## 7. `/go/[slug]` 페이지

레퍼런스 `app/page.js`를 거의 그대로 옮기되, **모든 하드코딩 문구를 DB 데이터로 치환**.

```
app/go/[slug]/page.js          ← 행사 안내 홈 (서버 컴포넌트)
app/go/[slug]/EventHome.js     ← 클라이언트 컴포넌트 (탭/모달/공지)
app/go/[slug]/record/page.js   ← 야디지 뷰어 (서버 컴포넌트)
app/go/[slug]/RecordViewer.js  ← 야디지 뷰어 클라이언트 컴포넌트
```

- `page.js`는 **서버 컴포넌트**. `@vercel/postgres`로 `event_pages` 조회 → 데이터를 `EventHome`에 prop 전달. 없으면 `notFound()`.
- Next.js 14+의 dynamic route params는 URL 디코드된 한글 슬러그가 자연스럽게 들어옴.
- "코스안내 바로가기" 버튼 링크: `/go/{slug}/record` (Link href로 넘기면 자동 인코딩).
- 지도 버튼 3종 — `map_links`가 채워진 것만 렌더.
- 공지 모달 — `notice.enabled = true` 일 때만 보임.
- **중식 탭** — `lunch`가 `null`이면 레퍼런스의 상단 "📍 행사 개요 / 🦆 중식 안내" 탭 자체를 숨기고 행사 개요만 단일 화면으로 렌더. `lunch`가 있을 때만 탭 UI 표시.

`/go/[slug]/record`도 같은 패턴: 서버에서 `yardage_images`, `green_images`, `par_info` 조회 후 뷰어에 전달.

이미지 src는 DB에 저장된 R2 public URL을 그대로 `<img src>`로.

---

## 8. 레퍼런스 코드 이식 시 손볼 곳

1. **하드코딩 → props**: `app/page.js`의 GROUPS, schedule, 주소 등은 모두 prop으로.
2. **이미지 경로**: `/sh/white/w${i}.jpg`, `/sh/green/g${i}.jpg` → DB에서 받은 URL 배열로.
3. **티 토글 (white/lady) → 제거**: 1세트만 사용하므로 토글 UI와 `teeType` 상태 삭제. 야디지 이미지는 항상 `yardage_images[hole-1].url`.
4. **`courseData[`${hole}홀`]` 공략 데이터 → 1차 제외**: "공략" 버튼과 모달 자체를 1차 작업에서 숨김. 추후 `hole_strategies` 컬럼 추가 시 다시 노출.
5. **`SEHYUN_PAR_INFO` 상수 → DB `par_info`**.
6. **`startCourse` 로직** (10번 홀부터 시작 → 표시 번호 변환): 그대로 유지. 조편성에서 `start` 값을 활용.
7. **`localStorage` 키 prefix**: `sh_currentHoleIdx` 등 레퍼런스 키가 슬러그별로 충돌하지 않도록 `event_{slug}_currentHoleIdx` 식으로 변경.
8. **`globals.css`**: 레퍼런스의 CSS 변수/클래스를 현재 프로젝트 `app/globals.css`에 추가. 충돌 시 prefix.
9. **`Analytics` 컴포넌트**: 레퍼런스 `layout.js`의 `@vercel/analytics/next` — 현재 프로젝트에 패키지 없음. 1차 작업에선 제외.
10. **튜토리얼 스포트라이트**: 단계 6 → 5로 (공략 제외분 빼고). 또는 1차에선 통째로 옵션.

---

## 9. 작업 단계 (PR 분할 제안)

1. **DB/API 토대** — `event_pages` 테이블 + `POST/GET /api/events`, `GET /api/events/[slug]`. ON CONFLICT 덮어쓰기 동작 확인.
2. **`/generate` 폼 (기본 정보만)** — 슬러그/타이틀/골프장 정보 + 제출 → `/go/{slug}` 최소 페이지 렌더 (한글 슬러그 라우팅 검증).
3. **이미지 업로드 UI** — 야디지 18 + 그린 18 입력, R2 업로드 흐름, 진행률.
4. **`/go/[slug]` 풀 안내 페이지** — 일정/조편성/시상/중식/공지 섹션 + 지도 버튼.
5. **`/go/[slug]/record` 야디지 뷰어** — 홀 선택/그린 모달/튜토리얼 (티 토글·공략 모달 제외).
6. (옵션) **편집 가드 / 인증** — 추후. 일단은 누구나 같은 슬러그로 덮어쓰기 가능.
7. (옵션) **홀별 공략 추가** — `hole_strategies` 컬럼 + 폼 18 textarea + 공략 버튼 재노출.

---

## 10. 남은 운영상 결정 (작업 진행 중 확인)

- 이미지 압축 옵션 (현재 `imageCompression.js`의 기본값) — 야디지/그린은 디테일이 중요하므로 quality 0.85 / max 1920px 정도가 적당한지 실측.
- `/generate`에서 작업 중 입력값 자동 저장? — 36장 업로드 도중 새로고침 시 폼 초기화되면 곤란. localStorage에 텍스트만이라도 임시 저장 권장.
- 잘못된 슬러그/URL 충돌 보호 — `/api`, `/dashboard`, `/record`, `/generate`, `/go` 자체와 같은 예약어를 슬러그로 못 쓰게 블랙리스트.

---

## 11. 검증 계획

수동:
- [ ] `/generate` 폼 모든 필드 입력, 36장 업로드, 제출 → `/go/{slug}` 진입 확인
- [ ] **한글 슬러그** (예: `/go/클럽359-5월`) 정상 동작 — 생성, 라우팅, 새로고침, 외부 링크 공유
- [ ] 동일 슬러그로 재제출 → 기존 페이지 덮어써짐 확인 (`updated_at` 갱신)
- [ ] 안내 페이지: 일시/장소/일정/조편성/시상/공지 모두 입력값과 일치
- [ ] 중식 체크박스 켠 경우: 탭 UI 등장 + 중식 정보 표시. 끈 경우: 탭 자체 숨김, 행사 개요만 단일 화면
- [ ] 지도 버튼 — 입력된 것만 렌더, 클릭 시 새 창
- [ ] `/go/{slug}/record` 진입: 18홀 야디지/그린 모두 로드, 홀 점프, 그린 모달 동작. **티 토글·공략 버튼 보이지 않음.**
- [ ] 잘못된 슬러그 (`/go/없는슬러그`) → 404
- [ ] 모바일(아이폰 Safari)에서 R2 공개 URL 이미지 로드 확인, `--app-height` 캔버스 표시 확인
- [ ] 예약어 슬러그 (`api`, `go`, `generate` 등) 거부 확인

자동 (있으면 좋음):
- API 라우트 단위 테스트 (`POST /api/events` 필수 필드 검증, 슬러그 정규식, 덮어쓰기 동작)
