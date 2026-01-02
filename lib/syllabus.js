import syllabus from "@/data/class10_science_syllabus.json";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export function getClass10ScienceSyllabus() {
  return syllabus;
}

export function getClass10ScienceChapters() {
  return syllabus.map((s) => s.chapter).filter(Boolean);
}

export function getClass10ScienceTopicsByChapter() {
  const map = new Map();
  for (const entry of syllabus) {
    const chapter = entry?.chapter;
    if (!chapter) continue;
    const topics = Array.isArray(entry?.topics) ? entry.topics : [];
    map.set(chapter, topics);
  }
  return map;
}

export function isClass10ScienceChapter(chapter) {
  const needle = normalize(chapter);
  if (!needle) return false;
  return getClass10ScienceChapters().some((c) => normalize(c) === needle);
}

