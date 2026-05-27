import { NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PROMPT = (sourceJsonText, courseHint) => `당신은 골프 코스 안내 데이터 정리 도우미입니다.

아래 JSON은 골프장 홈페이지에서 긁어온 임의 형식의 데이터입니다. 형식이 사이트마다 다를 수 있습니다.
주어진 데이터에서 각 홀(1번 홀 ~ 9번 홀)의 "코스 공략" 또는 "course tip" 또는 "공략" 내용에 해당하는 텍스트를 추출하세요.

규칙:
- 정확히 9개의 항목 ({"hole": 1, "tip": "..."} ~ {"hole": 9, "tip": "..."})을 반환합니다.
- "tip" 필드의 값은 해당 홀의 공략 텍스트 그대로(가급적 원문, 줄바꿈 \\n 보존)입니다.
- 공략 텍스트가 명확하지 않으면 가장 가까운 설명 텍스트를 사용하세요.
- 공략 텍스트가 전혀 없는 홀은 "tip"을 빈 문자열로 두세요.
- 거리, par, hdcp 등 다른 정보는 모두 무시합니다.
- 데이터에 여러 코스가 섞여 있다면 ${courseHint ? `"${courseHint}" 코스` : '첫 번째로 나오는 코스'}의 9홀만 사용합니다.
- 추가 설명, 머리말, 코드펜스 없이 JSON만 출력하세요.

출력 형식 (정확히 이 형식만):
{
  "tips": [
    { "hole": 1, "tip": "..." },
    { "hole": 2, "tip": "..." },
    { "hole": 3, "tip": "..." },
    { "hole": 4, "tip": "..." },
    { "hole": 5, "tip": "..." },
    { "hole": 6, "tip": "..." },
    { "hole": 7, "tip": "..." },
    { "hole": 8, "tip": "..." },
    { "hole": 9, "tip": "..." }
  ]
}

입력 데이터:
\`\`\`json
${sourceJsonText}
\`\`\``;

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' }, { status: 500 });
    }

    const body = await request.json();
    const { source, courseHint } = body || {};
    if (!source) {
      return NextResponse.json({ error: 'source가 필요합니다.' }, { status: 400 });
    }

    const sourceText = typeof source === 'string' ? source : JSON.stringify(source);
    if (sourceText.length > 200000) {
      return NextResponse.json({ error: '입력이 너무 큽니다 (200KB 이하).' }, { status: 400 });
    }

    const geminiBody = {
      contents: [{ role: 'user', parts: [{ text: PROMPT(sourceText, courseHint || '') }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Gemini API 오류: ${res.status}`, detail: errText.slice(0, 500) }, { status: 502 });
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return NextResponse.json({ error: 'Gemini 응답 형식 오류', detail: JSON.stringify(data).slice(0, 500) }, { status: 502 });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Gemini 응답 JSON 파싱 실패', detail: text.slice(0, 500) }, { status: 502 });
    }

    const tips = Array.isArray(parsed?.tips) ? parsed.tips : [];
    const normalized = Array.from({ length: 9 }, (_, i) => {
      const hole = i + 1;
      const found = tips.find(t => Number(t?.hole) === hole);
      return { hole, tip: typeof found?.tip === 'string' ? found.tip.trim() : '' };
    });

    return NextResponse.json({ tips: normalized });
  } catch (err) {
    console.error('POST /api/transform-tips error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
