import { getOpenAIClient } from "./openai";
import { retrievePyqSnippets } from "./retrieval";
import {
  getClass10ScienceChapters,
  getClass10ScienceTopicsByChapter,
} from "./syllabus";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDifficulty(value) {
  const v = String(value || "").toLowerCase();
  if (v === "easy" || v === "hard") return v;
  return "balanced";
}

function uniqueStrings(values) {
  return Array.from(
    new Set((Array.isArray(values) ? values : []).map((v) => String(v).trim()).filter(Boolean))
  );
}

function canonicalizeChapters(requestedChapters, allowedChapters) {
  const allowed = Array.isArray(allowedChapters) ? allowedChapters : [];
  const allowedByKey = new Map(allowed.map((c) => [normalize(c), c]));

  const valid = [];
  const invalid = [];

  for (const raw of requestedChapters) {
    const canonical = allowedByKey.get(normalize(raw));
    if (!canonical) {
      invalid.push(raw);
      continue;
    }
    if (!valid.some((c) => normalize(c) === normalize(canonical))) {
      valid.push(canonical);
    }
  }

  return { valid, invalid };
}

export async function generateSciencePaper(params) {
  const openai = getOpenAIClient();
  const classLevel = Number(params.classLevel ?? 10);
  if (classLevel !== 10) {
    throw new Error("Only CBSE Class 10 is supported right now.");
  }

  const subject = String(params.subject ?? "Science");
  if (normalize(subject) !== "science") {
    throw new Error("Only Science is supported right now.");
  }

  const allowedChapters = getClass10ScienceChapters();
  const requestedChapters = uniqueStrings(params.chapters);
  const { valid: validChapters, invalid: invalidChapters } = canonicalizeChapters(
    requestedChapters,
    allowedChapters
  );

  if (invalidChapters.length) {
    throw new Error(
      `Unknown chapter(s): ${invalidChapters.join(", ")}. Choose from: ${allowedChapters.join(", ")}`
    );
  }

  const selectedChapters = validChapters.length ? validChapters : allowedChapters;
  const difficulty = normalizeDifficulty(params.difficulty);

  const maxMarks = Number(params.maxMarks ?? 80) || 80;
  const durationMinutes = Number(params.durationMinutes ?? 180) || 180;

  const sections =
    params.sections ?? [
      { name: "Section A", description: "20 questions x 1 mark (MCQ)", questions: 20, marksEach: 1, type: "MCQ" },
      { name: "Section B", description: "6 questions x 2 marks (Short Answer)", questions: 6, marksEach: 2, type: "SA" },
      { name: "Section C", description: "7 questions x 3 marks (Short Answer)", questions: 7, marksEach: 3, type: "SA" },
      { name: "Section D", description: "3 questions x 5 marks (Long Answer)", questions: 3, marksEach: 5, type: "LA" },
      { name: "Section E", description: "3 case study questions x 4 marks", questions: 3, marksEach: 4, type: "Case Study" },
    ];

  const userPrompt = String(params.prompt || "").trim();

  const topicsByChapter = getClass10ScienceTopicsByChapter();
  const syllabusContext = selectedChapters.length
    ? `ALLOWED SYLLABUS (use only these chapters/topics):\n${selectedChapters
        .map((ch) => {
          const topics = topicsByChapter.get(ch) ?? [];
          const topicText = topics.length ? `: ${topics.join(", ")}` : "";
          return `- ${ch}${topicText}`;
        })
        .join("\n")}`
    : "ALLOWED SYLLABUS: (none provided)";

  const retrievalQuery = [
    `CBSE Class ${classLevel} ${subject} question paper`,
    selectedChapters.length ? `Chapters: ${selectedChapters.join(", ")}` : "",
    `Difficulty: ${difficulty}`,
    userPrompt ? `Custom: ${userPrompt}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const retrievalFilter = {
    subject: { $eq: "Science" },
    classLevel: { $eq: 10 },
    ...(selectedChapters.length && selectedChapters.length !== allowedChapters.length
      ? { chapter: { $in: selectedChapters } }
      : {}),
  };

  const { snippets } = await retrievePyqSnippets(retrievalQuery, {
    topK: 12,
    filter: retrievalFilter,
  });

  const pyqContext = snippets.length
    ? `PYQ SNIPPETS (for style reference; do not copy verbatim):\n\n${snippets
        .slice(0, 12)
        .map((s, i) => `${i + 1}. ${s}`)
        .join("\n\n")}`
    : "PYQ SNIPPETS: (none retrieved)";

  const rules = [
    `You are generating a CBSE Class ${classLevel} ${subject} question paper.`,
    "STRICT REQUIREMENTS:",
    "- Stay strictly within CBSE Class 10 Science (NCERT-aligned) syllabus.",
    "- Generate NEW questions in PYQ style; do NOT copy any provided question verbatim.",
    "- Use clear CBSE phrasing, proper units, and realistic board-level difficulty.",
    "- Provide marks for each question and ensure totals match.",
    "- Do not include content outside the allowed syllabus list.",
    selectedChapters.length
      ? `- Use only these chapters: ${selectedChapters.join(", ")}.`
      : "- Cover a balanced spread of Class 10 Science chapters.",
    `- Target difficulty: ${difficulty}.`,
  ].join("\n");

  const structure = [
    `PAPER SPECS:`,
    `- Time: ${durationMinutes} minutes`,
    `- Maximum Marks: ${maxMarks}`,
    "",
    "SECTION BLUEPRINT (follow this exactly unless impossible due to marks):",
    ...sections.map(
      (s) =>
        `- ${s.name}: ${s.description} (Questions: ${s.questions}, Marks each: ${s.marksEach}, Type: ${s.type})`
    ),
    "",
    "OUTPUT FORMAT:",
    "- Plain text (not JSON).",
    "- Include a short instruction block at the top (like CBSE papers).",
    "- Use numbered questions per section (e.g., A1..A20, B1..B6).",
    "- For case studies, include a short passage followed by sub-questions with marks split.",
    "- Do not include solutions/answers.",
  ].join("\n");

  const messages = [
    { role: "developer", content: rules },
    {
      role: "user",
      content: `${structure}\n\n${syllabusContext}\n\n${pyqContext}\n\nCUSTOM REQUEST:\n${userPrompt || "(none)"}`,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    temperature: 0.7,
  });

  const paper = completion?.choices?.[0]?.message?.content?.trim() || "";
  if (!paper) throw new Error("Model returned an empty response.");

  return { paper, meta: { model: DEFAULT_MODEL, retrievedSnippets: snippets.length } };
}
