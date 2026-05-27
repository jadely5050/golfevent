import { NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PROMPT = (sourceJsonText, valleyName, lakeName) => `당신은 골프 코스 안내 데이터 정리 도우미입니다.

아래 JSON은 골프장 홈페이지에서 긁어온 임의 형식의 데이터입니다. 형식이 사이트마다 다를 수 있고, 한 골프장의 여러 코스(9홀 단위)가 같이 들어있을 수 있습니다.
이 행사의 코스 구성:
- 1번홀~9번홀(앞 9홀) 코스명: "${valleyName || '미지정'}"
- 10번홀~18번홀(뒤 9홀) 코스명: "${lakeName || '미지정'}"

입력 데이터에서 위 두 코스명에 가장 잘 매칭되는 9홀 단위 데이터를 각각 찾고, 각 홀의 "코스 공략" / "course tip" / "공략" / 홀 설명 텍스트를 추출하세요.

규칙:
- "valley" 배열: 1번홀~9번홀 코스("${valleyName || '앞 9홀'}")의 9홀 tip
- "lake" 배열: 10번홀~18번홀 코스("${lakeName || '뒤 9홀'}")의 9홀 tip
- 각 배열은 정확히 9개 항목({"hole": <원본 홀번호 1~9>, "tip": "..."}) 입니다.
- 매칭되는 코스가 입력에 없으면 해당 배열을 빈 배열 []로 반환하세요.
- "tip"은 해당 홀의 공략 텍스트 원문(줄바꿈 \\n 보존). 명확한 공략이 없으면 가장 가까운 설명을 사용하고, 그것도 없으면 빈 문자열.
- 거리, par, hdcp 등 다른 정보는 모두 무시합니다.
- 코스명 매칭은 표기 차이를 관대하게 처리하세요 (예: "오아시스"와 "오아시스코스", "Oasis", "OASIS COURSE" 등 모두 동일 코스).
- 추가 설명·머리말·코드펜스 없이 JSON만 출력하세요.

출력 형식 (정확히 이 형식만):
{
  "valley": [
    { "hole": 1, "tip": "..." }, ..., { "hole": 9, "tip": "..." }
  ],
  "lake": [
    { "hole": 1, "tip": "..." }, ..., { "hole": 9, "tip": "..." }
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
    const { source, valleyCourseName, lakeCourseName } = body || {};
    if (!source) {
      return NextResponse.json({ error: 'source가 필요합니다.' }, { status: 400 });
    }

    const sourceText = typeof source === 'string' ? source : JSON.stringify(source);
    if (sourceText.length > 200000) {
      return NextResponse.json({ error: '입력이 너무 큽니다 (200KB 이하).' }, { status: 400 });
    }

    const geminiBody = {
      contents: [{ role: 'user', parts: [{ text: PROMPT(sourceText, valleyCourseName || '', lakeCourseName || '') }] }],
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

    const normalizeNine = (arr) => {
      const list = Array.isArray(arr) ? arr : [];
      return Array.from({ length: 9 }, (_, i) => {
        const hole = i + 1;
        const found = list.find(t => Number(t?.hole) === hole);
        return { hole, tip: typeof found?.tip === 'string' ? found.tip.trim() : '' };
      });
    };

    const valley = normalizeNine(parsed?.valley);
    const lake = normalizeNine(parsed?.lake);
    const valleyEmpty = valley.every(t => !t.tip);
    const lakeEmpty = lake.every(t => !t.tip);

    return NextResponse.json({
      valley: valleyEmpty ? [] : valley,
      lake: lakeEmpty ? [] : lake,
    });
  } catch (err) {
    console.error('POST /api/transform-tips error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
