import { NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PROMPT = (announcementText, awardText, todayIso) => `당신은 골프 동호회 라운드 공지 문구를 안내 페이지 입력 폼 데이터로 정리하는 도우미입니다.

아래 "공지 문구"는 회원들에게 보낸 라운드 안내 메시지 원문이고, "상품 리스트"는 시상 상품을 정리한 표(선택 사항)입니다. 형식은 작성자마다 다를 수 있습니다.
오늘 날짜는 ${todayIso} 입니다. 공지에 연도가 없으면 오늘 날짜 기준으로 가장 가까운 미래의 날짜로 추정하세요.

규칙:
- "title": 안내 페이지 제목. 공지의 대괄호/제목 줄(예: "2026년 9월 라운드 안내")을 다듬어 사용. 없으면 날짜와 골프장명으로 간단히 생성.
- "subtitle": 공지에 따옴표 등으로 강조된 부제/슬로건 문구(예: "May the PAR be with you!"). 없으면 빈 문자열.
- "event_date": 라운드 날짜를 "YYYY-MM-DD"로. 요일 텍스트는 무시하고 날짜만. 알 수 없으면 null.
- "course_name": 골프장 이름(지역명 포함 가능, 예: "용인 써닝포인트CC").
- "course_address": 골프장 주소. 공지에 명시 안 되어 있으면 null(중식 장소 주소와 혼동하지 말 것).
- "course_phone": 골프장 전화번호. 없으면 null.
- "course_distance_note": 출발지→골프장 이동 시간/거리 안내 문구(예: "여의도 - 써닝포인트CC 약 1시간 25분 소요"). 없으면 null.
- "schedule": 당일 시간표 배열 [{ "time": "HH:MM"(24시간제), "text": "..." }]. "집합", "티업", "중식" 등 시간이 명시된 항목만. 그늘집 안내처럼 시간 항목에 딸린 부가 설명은 같은 항목의 text에 줄바꿈(\\n)으로 포함.
- "groups": 조편성 표 배열 [{ "course": "코스명(예: SUN)", "time": "HH:MM", "players": "이름1/이름2/...", "start": "valley"|"lake" }].
  - 조편성에 등장하는 서로 다른 코스명은 최대 2개입니다. 표에서 가장 먼저 등장하는 코스명을 "valley"(1번홀 시작), 그 다음 코스명을 "lake"(10번홀 시작)로 지정하세요.
  - players는 표에 적힌 순서 그대로 "/"로 이어붙인 문자열. 게스트 표기 등 원문 그대로 유지.
- "valley_course_name": groups에서 "valley"로 지정한 코스명(문자열). 조편성이 없으면 null.
- "lake_course_name": groups에서 "lake"로 지정한 코스명(문자열). 조편성이 없으면 null.
- "award_text": 시상 관련 텍스트.
  - "상품 리스트" 입력이 있으면: 표의 각 행을 "번호. 분야(상 이름) — 경품" 형식 한 줄로 정리한 문자열(줄바꿈 \\n으로 행 구분). "분야"는 상의 이름(예: 베스트퍼포먼스상), "경품"은 상품 컬럼 값. 기준/선정 설명 컬럼은 생략. 경품 값이 큰따옴표로 감싸져 여러 줄로 되어 있으면 한 줄로 합치세요.
  - "상품 리스트"가 없고 공지 문구에 "시상" 관련 문구(예: "기 공지 내역 참고")만 있으면 그 문구 그대로 사용.
  - 둘 다 없으면 빈 문자열.
- "settlement_text": 정산/결제 관련 안내를 정리한 문자열(줄바꿈 \\n으로 항목 구분). 캐디피/카트비/개인정산 등. 없으면 빈 문자열.
- "lunch": 중식(점심) 장소 안내가 있으면 { "enabled": true, "name": "...", "address": "...", "phone": "...", "menu": "..." }, 없으면 { "enabled": false, "name": "", "address": "", "phone": "", "menu": "" }.

추가 설명·머리말·코드펜스 없이 JSON만 출력하세요. 위에서 설명한 키만 정확히 이 이름으로 포함한 하나의 JSON 객체를 출력하세요.

공지 문구:
"""
${announcementText}
"""

상품 리스트:
"""
${awardText || '(없음)'}
"""`;

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' }, { status: 500 });
    }

    const body = await request.json();
    const { announcementText, awardText } = body || {};
    if (!announcementText || typeof announcementText !== 'string' || !announcementText.trim()) {
      return NextResponse.json({ error: '공지 문구가 필요합니다.' }, { status: 400 });
    }
    if (announcementText.length > 50000 || (awardText && awardText.length > 50000)) {
      return NextResponse.json({ error: '입력이 너무 큽니다 (각 50KB 이하).' }, { status: 400 });
    }

    const todayIso = new Date().toISOString().slice(0, 10);

    const geminiBody = {
      contents: [{ role: 'user', parts: [{ text: PROMPT(announcementText, awardText || '', todayIso) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Gemini API error', res.status, errText.slice(0, 1000));
      return NextResponse.json({ error: `Gemini API 오류 ${res.status}`, detail: errText.slice(0, 800) }, { status: 502 });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const finishReason = data?.candidates?.[0]?.finishReason;
      const promptFeedback = data?.promptFeedback;
      console.error('Gemini empty response', { finishReason, promptFeedback, sample: JSON.stringify(data).slice(0, 800) });
      return NextResponse.json({ error: 'Gemini 응답이 비어있습니다', detail: JSON.stringify({ finishReason, promptFeedback }).slice(0, 800) }, { status: 502 });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Gemini 응답 JSON 파싱 실패', detail: text.slice(0, 500) }, { status: 502 });
    }

    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    const dateStr = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null);
    const timeStr = (v) => {
      if (typeof v !== 'string') return '';
      const m = v.trim().match(/^(\d{1,2}):(\d{2})/);
      if (!m) return v.trim();
      return `${m[1].padStart(2, '0')}:${m[2]}`;
    };

    const schedule = Array.isArray(parsed?.schedule)
      ? parsed.schedule
          .filter(r => r && (r.time || r.text))
          .map(r => ({ time: timeStr(r.time), text: str(r.text) }))
      : [];

    const groups = Array.isArray(parsed?.groups)
      ? parsed.groups
          .filter(g => g && (g.course || g.players))
          .map(g => ({
            course: str(g.course),
            time: timeStr(g.time),
            players: str(g.players),
            start: g.start === 'lake' ? 'lake' : 'valley',
          }))
      : [];

    const lunchRaw = parsed?.lunch || {};
    const lunch = {
      enabled: !!lunchRaw.enabled,
      name: str(lunchRaw.name),
      address: str(lunchRaw.address),
      phone: str(lunchRaw.phone),
      menu: str(lunchRaw.menu),
    };

    return NextResponse.json({
      title: str(parsed?.title),
      subtitle: str(parsed?.subtitle),
      event_date: dateStr(parsed?.event_date),
      course_name: str(parsed?.course_name),
      course_address: str(parsed?.course_address),
      course_phone: str(parsed?.course_phone),
      course_distance_note: str(parsed?.course_distance_note),
      schedule,
      groups,
      valley_course_name: str(parsed?.valley_course_name),
      lake_course_name: str(parsed?.lake_course_name),
      award_text: str(parsed?.award_text),
      settlement_text: str(parsed?.settlement_text),
      lunch,
    });
  } catch (err) {
    console.error('POST /api/transform-announcement error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
