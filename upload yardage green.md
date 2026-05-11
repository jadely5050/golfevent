# 야디지 및 그린 이미지 업로드 기능 구현 계획

## 1. 개요
라운드 설정 모달에서 새로운 코스를 추가하고, 각 홀별 야디지 이미지(18장)와 그린 이미지(18장)를 순서대로 업로드하여 Cloudflare R2에 저장하고 데이터베이스에 등록하는 기능을 구현합니다.

## 2. 주요 변경 사항

### A. 데이터베이스 (PostgreSQL)
- `golf_courses` 테이블 생성
  - `id`: TEXT PRIMARY KEY
  - `name`: TEXT (코스명)
  - `yardage_images`: JSONB (18개의 이미지 URL 배열)
  - `green_images`: JSONB (18개의 이미지 URL 배열)
  - `created_at`: TIMESTAMP

### B. 백엔드 API (`/api/courses`)
- `POST /api/courses`: 새로운 코스 정보 저장
- `GET /api/courses`: 등록된 코스 목록 조회
- `POST /api/upload`: 기존 업로드 로직을 확장하여 `path` 매개변수 지원
  - 저장 경로: 
    - 야디지: `yardage/{course_name}/course/{hole_number}.jpg`
    - 그린: `yardage/{course_name}/green/{hole_number}.jpg`
- **`/api/image` (New)**: R2 비공개 버킷 이미지를 프록시하여 전달하는 API
  - 사용법: `/api/image?key={r2_key}`

### C. 프론트엔드 (`app/record/page.js`)
- **라운드 설정 모달 (`showParSettingsModal`)**
  - 기존 코스 선택 드롭다운 (DB에서 가져온 목록 표시)
  - "코스 추가" 버튼 추가 -> 코스 추가 모달 열기
- **코스 추가 모달**
  - "코스명" 입력 필드
  - "코스 이미지 선택" 버튼: 파일 선택창(multiple)을 통해 18장 선택 (선택된 파일 개수 표시 및 미리보기)
  - "그린 이미지 선택" 버튼: 파일 선택창(multiple)을 통해 18장 선택
  - "업로드" 버튼: 
    - 이미지들을 순차적으로 R2에 업로드
    - 모든 업로드 완료 후 DB에 코스 정보 저장
    - 업로드 중 프로그레스 표시 (예: 1/36 업로드 중...)

## 3. 세부 구현 로직

### 이미지 업로드 흐름
1. 사용자가 18장의 파일을 선택하면 파일명 순(또는 선택 순)으로 정렬하여 상태에 저장합니다.
2. 업로드 버튼 클릭 시:
   - `for` 루프를 통해 하나씩 `/api/upload` 호출
   - 각 파일에 대해 `fileName`을 `{holeIdx+1}.jpg`로 지정하고 `path`를 전달
3. 업로드된 결과에서 `key`를 받아 `/api/image?key={key}` 형태의 프록시 URL을 생성
4. 모든 프록시 URL을 수집하여 `/api/courses`에 POST 요청

### R2 저장 구조
- `yardage/`
  - `{course_name}/`
    - `course/`
      - `1.jpg`, `2.jpg`, ..., `18.jpg`
    - `green/`
      - `1.jpg`, `2.jpg`, ..., `18.jpg`

## 4. 고려 사항
- **이미지 압축**: 업로드 전 클라이언트 사이드에서 이미지 압축 적용 (기존 `compressImage` 유틸 활용)
- **에러 처리**: 업로드 중 실패 시 재시도 또는 안내 메시지 표시
- **순서 보장**: 파일 선택 시 순서가 섞이지 않도록 사용자 가이드 제공 또는 파일명 기준 정렬

---
> [!NOTE]
> 이 계획에 대해 코멘트 부탁드립니다. 확인 후 실제 구현을 진행하겠습니다.
