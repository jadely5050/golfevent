/**
 * 코스 등록용 ZIP 파일 파서.
 *
 * ZIP 하나에 골프장의 야디지/그린 이미지와 홀 정보(파, 공략) JSON을 담아
 * "새 코스 추가" 모달에서 한 번에 등록하기 위한 유틸.
 *
 * 포맷 설명은 저장소 루트의 `coursezipformat.md` 참고.
 */

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const GREEN_HINT = /그린|green/i;
const IGNORE_HINT = /언듈레이션|undulation/i;
const HOLE_KEY = /^([0-9]+)홀$/;
const JSON_EXT = /\.json$/i;

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

const isJunkPath = (path) =>
  path.startsWith('__MACOSX/') ||
  path.split('/').some(seg => seg.startsWith('._') || seg === '.DS_Store' || seg === 'Thumbs.db');

/**
 * 서브코스 폴더가 최상위로 오도록 공통 상위 폴더(골프장 이름 폴더 등)를 벗겨낸다.
 * 서브코스 개수만큼 폴더가 드러나면 멈추므로, 서브코스가 1개인 ZIP에서
 * 코스 폴더 자체를 벗겨내 버리는 일이 없다.
 */
const stripCommonRoot = (paths, neededFolders) => {
  let current = paths.slice();

  const imageFolderCount = (list) => {
    const folders = new Set();
    for (const p of list) {
      if (!IMAGE_EXT.test(p)) continue;
      const segments = p.split('/');
      folders.add(segments.length > 1 ? segments[0] : '');
    }
    return folders.size;
  };

  while (imageFolderCount(current) < neededFolders) {
    const first = current[0].split('/');
    if (first.length < 2) break;
    const head = first[0];
    if (!current.every(p => p.startsWith(`${head}/`) && p.split('/').length >= 2)) break;
    current = current.map(p => p.slice(head.length + 1));
  }

  return Object.fromEntries(paths.map((p, i) => [p, current[i]]));
};

const baseName = (path) => path.split('/').pop();

/** 파일명에 들어있는 마지막 숫자(홀 번호로 사용). 없으면 null. */
const holeNumberOf = (path) => {
  const name = baseName(path).replace(IMAGE_EXT, '');
  const nums = name.match(/\d+/g);
  if (!nums) return null;
  return parseInt(nums[nums.length - 1], 10);
};

const sortByHoleNumber = (entries) =>
  entries.slice().sort((a, b) => {
    const na = holeNumberOf(a.path);
    const nb = holeNumberOf(b.path);
    if (na != null && nb != null && na !== nb) return na - nb;
    if (na != null && nb == null) return -1;
    if (na == null && nb != null) return 1;
    return a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' });
  });

/** 폴더명/코스명 비교용 정규화: 공백·대소문자·"코스"/"course" 접미사 제거. */
const normalizeName = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/(코스|course)$/i, '');

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/**
 * JSON에서 골프장 이름과 서브코스 목록을 뽑아낸다.
 * - `골프장` 문자열 키를 제외한 최상위 객체 키가 각각 서브코스.
 * - `코스` 키 아래에 한 겹 더 감싸진 형태도 지원.
 */
export const parseCourseInfoJson = (raw) => {
  if (!isPlainObject(raw)) throw new Error('코스정보 JSON 형식이 올바르지 않습니다.');

  const clubName = typeof raw['골프장'] === 'string' ? raw['골프장'].trim() : '';
  const distanceUnit = typeof raw['거리단위'] === 'string' ? raw['거리단위'].trim() : '';

  const container = isPlainObject(raw['코스']) ? raw['코스'] : raw;

  const subCourses = [];
  for (const [key, value] of Object.entries(container)) {
    if (!isPlainObject(value)) continue;
    if (key === '코스') continue;

    const holes = [];
    for (const [holeKey, holeValue] of Object.entries(value)) {
      const m = holeKey.match(HOLE_KEY);
      if (!m || !isPlainObject(holeValue)) continue;
      holes.push({
        hole: parseInt(m[1], 10),
        par: Number(holeValue['파']) || 4,
        tip: typeof holeValue['공략'] === 'string' ? holeValue['공략'] : ''
      });
    }
    if (holes.length === 0) continue;

    holes.sort((a, b) => a.hole - b.hole);
    subCourses.push({
      key,
      name: (typeof value['코스명'] === 'string' && value['코스명'].trim()) || key,
      holes
    });
  }

  if (subCourses.length === 0) throw new Error('코스정보 JSON에서 서브코스를 찾지 못했습니다.');

  return { clubName, distanceUnit, subCourses };
};

/** 서브코스 이름과 가장 잘 맞는 이미지 폴더를 고른다. */
const matchFolder = (subCourse, folders, usedFolders) => {
  const candidates = folders.filter(f => !usedFolders.has(f));
  const targets = [subCourse.name, subCourse.key];

  for (const target of targets) {
    const exact = candidates.find(f => f === target);
    if (exact != null) return exact;
  }
  for (const target of targets) {
    const partial = candidates.find(f => f.includes(target) || target.includes(f));
    if (partial != null) return partial;
  }
  for (const target of targets) {
    const norm = normalizeName(target);
    if (!norm) continue;
    const loose = candidates.find(f => {
      const nf = normalizeName(f);
      return nf === norm || nf.includes(norm) || norm.includes(nf);
    });
    if (loose != null) return loose;
  }
  return null;
};

/**
 * 코스 등록용 ZIP을 파싱한다.
 * @param {File|Blob|ArrayBuffer} zipFile
 * @returns {Promise<{clubName: string, distanceUnit: string, subCourses: Array}>}
 *   각 서브코스: { key, name, folder, holes, yardageFiles: File[9], greenFiles: File[] (0 또는 9) }
 */
export const parseCourseZip = async (zipFile) => {
  // 코스 등록 모달에서만 쓰이므로 번들 분리를 위해 동적 import 한다.
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(zipFile);

  const paths = [];
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    if (isJunkPath(path)) return;
    paths.push(path);
  });

  if (paths.length === 0) throw new Error('ZIP 파일이 비어 있습니다.');

  const jsonPaths = paths.filter(p => JSON_EXT.test(p));
  if (jsonPaths.length === 0) throw new Error('ZIP 안에서 코스정보 JSON 파일을 찾지 못했습니다.');

  const jsonText = await zip.file(jsonPaths[0]).async('string');
  let rawInfo;
  try {
    rawInfo = JSON.parse(jsonText.replace(/^﻿/, ''));
  } catch (err) {
    throw new Error(`코스정보 JSON을 읽을 수 없습니다: ${err.message}`);
  }

  const { clubName, distanceUnit, subCourses } = parseCourseInfoJson(rawInfo);

  const strippedByPath = stripCommonRoot(paths, subCourses.length);

  // 폴더별 이미지 분류
  const byFolder = new Map(); // folder -> { yardage: [], green: [] }
  for (const path of paths) {
    if (!IMAGE_EXT.test(path)) continue;
    const rel = strippedByPath[path];
    const segments = rel.split('/');
    const folder = segments.length > 1 ? segments[0] : '';
    // 코스 폴더명(골프장/코스 이름)이 키워드에 걸리지 않도록 그 아래 경로만 보고 분류한다.
    const inner = segments.length > 1 ? segments.slice(1).join('/') : rel;

    if (IGNORE_HINT.test(inner)) continue;
    if (!byFolder.has(folder)) byFolder.set(folder, { yardage: [], green: [] });

    const bucket = GREEN_HINT.test(inner) ? 'green' : 'yardage';
    byFolder.get(folder)[bucket].push({ path, rel });
  }

  const folders = Array.from(byFolder.keys());
  const usedFolders = new Set();

  // 1차: 이름 매칭
  const assigned = subCourses.map(sc => {
    const folder = matchFolder(sc, folders, usedFolders);
    if (folder != null) usedFolders.add(folder);
    return { subCourse: sc, folder };
  });

  // 2차: 이름 매칭 실패분은 야디지가 정확히 9장인 미사용 폴더를 순서대로 폴백 사용
  const fallbackFolders = folders.filter(
    f => !usedFolders.has(f) && byFolder.get(f).yardage.length === 9
  );
  for (const item of assigned) {
    if (item.folder != null) continue;
    const folder = fallbackFolders.shift();
    if (folder == null) {
      throw new Error(`'${item.subCourse.name}' 코스의 이미지 폴더를 찾지 못했습니다.`);
    }
    usedFolders.add(folder);
    item.folder = folder;
  }

  const toFile = async (entry) => {
    const blob = await zip.file(entry.path).async('blob');
    const name = baseName(entry.path);
    const ext = (name.split('.').pop() || '').toLowerCase();
    const type = MIME_BY_EXT[ext] || 'image/jpeg';
    return new File([blob], name, { type });
  };

  const result = [];
  for (const { subCourse, folder } of assigned) {
    const images = byFolder.get(folder);
    const label = folder || '(최상위)';

    if (images.yardage.length !== 9) {
      throw new Error(
        `'${label}' 폴더의 야디지(코스) 이미지가 9장이 아닙니다(${images.yardage.length}장)`
      );
    }
    if (images.green.length !== 0 && images.green.length !== 9) {
      throw new Error(
        `'${label}' 폴더의 그린 이미지가 9장이 아닙니다(${images.green.length}장). 0장이면 기본 그린 이미지를 사용합니다.`
      );
    }

    const yardageFiles = [];
    for (const entry of sortByHoleNumber(images.yardage)) yardageFiles.push(await toFile(entry));
    const greenFiles = [];
    for (const entry of sortByHoleNumber(images.green)) greenFiles.push(await toFile(entry));

    result.push({ ...subCourse, folder: label, yardageFiles, greenFiles });
  }

  return { clubName, distanceUnit, subCourses: result };
};

/**
 * 파싱 결과를 18홀 등록 형태로 편성한다.
 * @param {Object} parsed parseCourseZip 결과
 * @param {Object} options
 * @param {boolean} options.repeatNine 9홀을 2번 도는 골프장이면 서브코스 1개를 OUT/IN으로 복제
 * @param {number} options.outIndex OUT(1~9홀)으로 쓸 서브코스 인덱스
 * @param {number} options.inIndex IN(10~18홀)으로 쓸 서브코스 인덱스
 * @returns {{courseName: string, sections: Array, holes: Array}}
 */
export const buildCourseLayout = (parsed, { repeatNine = false, outIndex = 0, inIndex = 1 } = {}) => {
  const all = parsed.subCourses;
  let sections;

  if (repeatNine) {
    const only = all[outIndex] || all[0];
    if (!only) throw new Error('등록할 서브코스가 없습니다.');
    sections = [only, only];
  } else {
    if (all.length < 2) {
      throw new Error(
        '18홀을 구성하려면 서브코스가 2개 이상이어야 합니다. 9홀을 2번 도는 골프장이면 해당 옵션을 켜주세요.'
      );
    }
    const out = all[outIndex];
    const inn = all[inIndex];
    if (!out || !inn) throw new Error('OUT/IN 코스를 선택해주세요.');
    if (outIndex === inIndex) {
      throw new Error('OUT과 IN에 서로 다른 코스를 선택하거나, 9홀을 2번 도는 골프장 옵션을 켜주세요.');
    }
    sections = [out, inn];
  }

  const holes = [];
  sections.forEach((section, sectionIdx) => {
    for (let i = 0; i < 9; i++) {
      const hole = section.holes.find(h => h.hole === i + 1) || { par: 4, tip: '' };
      holes.push({
        hole: sectionIdx * 9 + i + 1,
        par: Number(hole.par) || 4,
        tip: hole.tip || '',
        section: section.name
      });
    }
  });

  return {
    courseName: parsed.clubName || sections.map(s => s.name).join('/'),
    sections,
    holes
  };
};
