"use client";

import { useMemo, useState } from "react";
import { getClass10ScienceChapters } from "@/lib/syllabus";

const SYLLABUS_CHAPTERS = getClass10ScienceChapters();
const CHAPTER_BY_KEY = new Map(
  SYLLABUS_CHAPTERS.map((c) => [String(c).trim().toLowerCase(), c])
);
const DEFAULT_CHAPTERS = SYLLABUS_CHAPTERS.slice(0, 2);

export default function Home() {
  const [chapters, setChapters] = useState(DEFAULT_CHAPTERS);
  const [chapterSearch, setChapterSearch] = useState("");
  const [difficulty, setDifficulty] = useState("balanced");
  const [customPrompt, setCustomPrompt] = useState("");
  const [paper, setPaper] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const totalQuestions = 39;
  const durationMinutes = 180;
  const maxMarks = 80;

  const hintText = useMemo(
    () => `Approximate duration: ${durationMinutes} mins`,
    [durationMinutes]
  );

  function addChapter(raw) {
    const value = String(raw || "").trim();
    if (!value) return;
    const key = value.toLowerCase();
    const canonical = CHAPTER_BY_KEY.get(key);
    if (!canonical) return;

    setChapters((prev) => {
      const exists = prev.some((c) => c.toLowerCase() === key);
      return exists ? prev : [...prev, canonical];
    });
  }

  function removeChapter(value) {
    const key = String(value || "").toLowerCase();
    setChapters((prev) => prev.filter((c) => c.toLowerCase() !== key));
  }

  const chaptersKey = useMemo(
    () => new Set(chapters.map((c) => String(c).trim().toLowerCase())),
    [chapters]
  );

  const allSyllabusSelected = useMemo(() => {
    if (!SYLLABUS_CHAPTERS.length) return false;
    return SYLLABUS_CHAPTERS.every((c) =>
      chaptersKey.has(String(c).trim().toLowerCase())
    );
  }, [chaptersKey]);

  async function generatePaper() {
    setError("");
    setPaper("");
    setLoading(true);
    try {
      const res = await fetch("/api/paper/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classLevel: 10,
          subject: "Science",
          chapters,
          difficulty,
          maxMarks,
          durationMinutes,
          prompt: customPrompt,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      setPaper(String(data.paper || ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copyPaper() {
    if (!paper) return;
    try {
      await navigator.clipboard.writeText(paper);
    } catch {
      // noop
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="logo">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 3L2 7.5L12 12L22 7.5L12 3Z" fill="#1F5CF1" />
                <path
                  d="M4 10.5V16.5L12 21L20 16.5V10.5"
                  stroke="#1F5CF1"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              EduPaper Gen <span>AI</span>
            </div>
          </div>
          <nav className="nav">
            <a href="#">Dashboard</a>
            <a href="#" className="active">
              Generator
            </a>
            <a href="#">My Library</a>
            <a href="#">Curriculum</a>
            <div className="nav-icons">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 4C9.2 4 7 6.2 7 9V12.6L5.4 15.2C5 15.9 5.5 16.8 6.3 16.8H17.7C18.5 16.8 19 15.9 18.6 15.2L17 12.6V9C17 6.2 14.8 4 12 4Z"
                  stroke="#5B657B"
                  strokeWidth="1.6"
                />
                <path
                  d="M10 18C10.3 19.1 11.1 20 12.5 20C13.9 20 14.7 19.1 15 18"
                  stroke="#5B657B"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <div className="avatar">
                <svg
                  width="38"
                  height="38"
                  viewBox="0 0 44 44"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect width="44" height="44" rx="22" fill="#FFD3B6" />
                  <path
                    d="M22 23.5C25.0376 23.5 27.5 21.0376 27.5 18C27.5 14.9624 25.0376 12.5 22 12.5C18.9624 12.5 16.5 14.9624 16.5 18C16.5 21.0376 18.9624 23.5 22 23.5Z"
                    fill="#7C4A3A"
                  />
                  <path
                    d="M13.5 32.5C15.7 29.5 18.5 27.8 22 27.8C25.5 27.8 28.3 29.5 30.5 32.5"
                    stroke="#7C4A3A"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </nav>
        </div>
      </header>

      <main className="container">
        <div className="badge reveal">CBSE 2024-25 Compliant</div>

        <div className="page-title reveal delay-1">
          <div>
            <h1>Create New Assessment</h1>
            <p className="subtitle">
              Configure parameters to generate an AI-powered question paper.
            </p>
          </div>
          <button className="ghost-btn" type="button">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 5V3L8 7L12 11V9C15.3 9 18 11.7 18 15C18 16.2 17.6 17.3 16.9 18.2"
                stroke="#1E293B"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 19C8.7 19 6 16.3 6 13C6 11.8 6.4 10.7 7.1 9.8"
                stroke="#1E293B"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Load Draft
          </button>
        </div>

        <div className="layout">
          <div>
            <div className="card pad reveal delay-2">
              <div className="section-title">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M5 6H19"
                    stroke="#1F5CF1"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M5 12H19"
                    stroke="#1F5CF1"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M5 18H13"
                    stroke="#1F5CF1"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <circle cx="18" cy="18" r="2" fill="#1F5CF1" />
                </svg>
                Paper Configuration
              </div>
              <div className="divider"></div>

              <div className="form-grid">
                <div>
                  <label>Class</label>
                  <div className="select">
                    <span>Class 10</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6 9L12 15L18 9"
                        stroke="#6B7280"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <div>
                  <label>Subject</label>
                  <div className="select">
                    <span>Science</span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6 9L12 15L18 9"
                        stroke="#6B7280"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="topic-row">
                <label>Topics &amp; Chapters</label>
                <a
                  className="topic-link"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setChapters(allSyllabusSelected ? [] : SYLLABUS_CHAPTERS);
                  }}
                >
                  {allSyllabusSelected
                    ? "Clear Selection"
                    : "Select All from Syllabus"}
                </a>
              </div>
              <div className="search">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="7"
                    stroke="#7C879B"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M20 20L17 17"
                    stroke="#7C879B"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  type="text"
                  value={chapterSearch}
                  placeholder="Search for chapters (e.g., Acids, Metals)..."
                  list="syllabus-chapters"
                  onChange={(e) => setChapterSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    addChapter(chapterSearch);
                    setChapterSearch("");
                  }}
                />
                <datalist id="syllabus-chapters">
                  {SYLLABUS_CHAPTERS.map((ch) => (
                    <option key={ch} value={ch} />
                  ))}
                </datalist>
              </div>
              <div className="chips">
                {chapters.map((c) => (
                  <div key={c} className="chip">
                    {c}{" "}
                    <button
                      type="button"
                      className="close-btn"
                      aria-label={`Remove ${c}`}
                      onClick={() => removeChapter(c)}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              <div className="textarea">
                <label>Custom instructions (optional)</label>
                <textarea
                  value={customPrompt}
                  placeholder="Example: Focus more on Physics; include 1 case-study from Electricity."
                  onChange={(e) => setCustomPrompt(e.target.value)}
                />
              </div>

              <div className="divider-lg"></div>

              <div className="row">
                <div>
                  <label>Difficulty Level</label>
                  <div className="segmented">
                    <button
                      type="button"
                      className={difficulty === "easy" ? "active" : ""}
                      onClick={() => setDifficulty("easy")}
                    >
                      Easy
                    </button>
                    <button
                      type="button"
                      className={difficulty === "balanced" ? "active" : ""}
                      onClick={() => setDifficulty("balanced")}
                    >
                      Balanced
                    </button>
                    <button
                      type="button"
                      className={difficulty === "hard" ? "active" : ""}
                      onClick={() => setDifficulty("hard")}
                    >
                      Hard
                    </button>
                  </div>
                </div>
                <div>
                  <label>Total Questions</label>
                  <div className="input" aria-disabled="true">
                    <input type="number" value={totalQuestions} disabled />
                  </div>
                  <div className="hint">{hintText}</div>
                </div>
              </div>

              <button className="advanced" type="button">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 8H20"
                    stroke="#657089"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4 16H20"
                    stroke="#657089"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <circle cx="9" cy="8" r="2" fill="#657089" />
                  <circle cx="15" cy="16" r="2" fill="#657089" />
                </svg>
                Advanced Settings (Section breakdown, Bloom&apos;s Taxonomy)
              </button>
            </div>

            <button
              className="primary-btn reveal delay-3"
              type="button"
              onClick={generatePaper}
              disabled={loading}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L14.3 8.4L20.8 9.2L15.6 13.2L17.2 19.6L12 16.1L6.8 19.6L8.4 13.2L3.2 9.2L9.7 8.4L12 2Z"
                  fill="#FFFFFF"
                />
              </svg>
              {loading ? "Generating..." : "Generate Question Paper"}
            </button>

            {(paper || error) && (
              <div className="card output reveal">
                <div className="output-head">
                  <div className="output-title">Generated Paper</div>
                  <button
                    type="button"
                    className="small-btn"
                    onClick={copyPaper}
                    disabled={!paper}
                  >
                    Copy
                  </button>
                </div>
                {error ? <div className="error-banner">{error}</div> : null}
                {paper ? <pre>{paper}</pre> : null}
              </div>
            )}
          </div>

          <div className="side">
            <div className="card insights reveal delay-2">
              <div className="label">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 18H15M10 21H14M7 9C7 6.2 9.2 4 12 4C14.8 4 17 6.2 17 9C17 11.3 15.5 13.2 13.4 13.8C12.5 14.1 12 15 12 16V16"
                    stroke="#8FB2FF"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                AI INSIGHTS
              </div>
              <p>
                Tip: For Class X Science, case-study questions often combine a short
                passage with 4 sub-parts (1 mark each).
              </p>
              <div className="recommend">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="#C9D7FF"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M12 8V12"
                    stroke="#C9D7FF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="16" r="1" fill="#C9D7FF" />
                </svg>
                Recommendation: Add at least 1 case-study from a prioritized chapter.
              </div>
            </div>

            <div className="card recent reveal delay-3 stack-gap">
              <h3>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 6V12L16 14"
                    stroke="#5B657B"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="12" r="9" stroke="#5B657B" strokeWidth="1.6" />
                </svg>
                Recent Generations
              </h3>
              <div className="recent-list">
                <div className="recent-item">
                  <div className="icon-box icon-orange">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M8 4H16L18 8H6L8 4Z" fill="currentColor" />
                      <path d="M7 8V20H17V8" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </div>
                  <div>
                    <strong>Science Pre-Board Set A</strong>
                    <span>Class 10 - 80 Marks</span>
                  </div>
                </div>
                <div className="recent-item">
                  <div className="icon-box icon-purple">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M7 4H17V20H7V4Z" stroke="currentColor" strokeWidth="1.6" />
                      <path
                        d="M9 8H15"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <path
                        d="M9 12H15"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <strong>Light - Practice Paper</strong>
                    <span>Class 10 - 39 Questions</span>
                  </div>
                </div>
                <div className="recent-item">
                  <div className="icon-box icon-blue">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M5 5H19V19H5V5Z" stroke="currentColor" strokeWidth="1.6" />
                      <path
                        d="M7 9H17"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <path
                        d="M7 13H17"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <strong>Chemical Reactions - Unit Test</strong>
                    <span>Class 10 - Mixed</span>
                  </div>
                </div>
              </div>
              <div className="view-all">
                <a href="#">View All Papers</a>
              </div>
            </div>

            <div className="card feature reveal delay-4 stack-gap">
              <h4>New Feature</h4>
              <p>Generate answer keys with step-by-step solutions automatically.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
