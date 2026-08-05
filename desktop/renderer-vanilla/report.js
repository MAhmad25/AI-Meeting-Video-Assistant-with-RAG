"use strict";

/**
 * Report View — lined-paper cards in a masonry layout.
 * Exposes window.ReportViewer.render(report, meta)
 */

(function () {
      function el(tag, className, text) {
            const node = document.createElement(tag);
            if (className) node.className = className;
            if (text !== undefined) node.textContent = text;
            return node;
      }

      /** Lined-paper card shell (provided container design) */
      function PaperCard(options) {
            const {
                  title,
                  subtitle,
                  eyebrow,
                  meta,
                  body,
                  items,
                  badges,
                  variant = "section",
            } = options;

            const card = el("article", "paper-card paper-card--" + variant);

            if (eyebrow) card.appendChild(el("span", "paper-card__eyebrow", eyebrow));
            if (title) card.appendChild(el("h3", "paper-card__title", title));
            if (subtitle) card.appendChild(el("p", "paper-card__subtitle", subtitle));
            if (meta) card.appendChild(el("div", "paper-card__meta", meta));

            if (badges && badges.length) {
                  const row = el("div", "paper-card__badges");
                  badges.forEach((b) => row.appendChild(el("span", "paper-card__badge", b)));
                  card.appendChild(row);
            }

            const hasList = items && items.length > 0;
            const hasBody = body && String(body).trim();

            if (hasBody) card.appendChild(el("p", "paper-card__body", body));

            if (hasList) {
                  const ul = el("ul", "paper-card__list");
                  items.forEach((item) => {
                        const li = el("li", "paper-card__list-item");
                        if (typeof item === "string") {
                              li.appendChild(document.createTextNode(item));
                        } else {
                              li.appendChild(document.createTextNode(item.text || ""));
                              if (item.meta) li.appendChild(el("span", "paper-card__list-meta", item.meta));
                        }
                        ul.appendChild(li);
                  });
                  card.appendChild(ul);
            }

            if (!hasList && !hasBody && !subtitle) {
                  card.appendChild(el("p", "paper-card__empty", "None noted"));
            }

            return card;
      }

      function listSection(title, items) {
            const list = (items || []).filter(Boolean);
            if (!list.length) {
                  return PaperCard({ title, body: "None noted" });
            }
            return PaperCard({ title, items: list });
      }

      function textSection(title, content) {
            return PaperCard({ title, body: content || "None noted" });
      }

      function buildMeetingSections(report) {
            const sections = [];

            sections.push({
                  kind: "featured",
                  title: report.title,
                  subtitle: report.executive_summary,
                  badges: report.keywords || [],
                  eyebrow: "Meeting Report",
            });

            sections.push({ kind: "text", title: "Purpose", content: report.meeting_purpose });
            sections.push({ kind: "list", title: "Key Decisions", items: report.key_decisions });
            sections.push({ kind: "list", title: "Discussion Topics", items: report.discussion_topics });

            const actions = (report.action_items || []).map((item) => {
                  const parts = [];
                  if (item.assignee) parts.push(item.assignee);
                  if (item.deadline) parts.push("Due " + item.deadline);
                  return { text: item.task, meta: parts.join(" · ") || undefined };
            });
            sections.push({ kind: "actions", title: "Action Items", items: actions });

            sections.push({ kind: "list", title: "Open Questions", items: report.open_questions });
            sections.push({ kind: "list", title: "Risks & Blockers", items: report.risks_and_blockers });
            sections.push({ kind: "list", title: "Deadlines", items: report.deadlines });
            sections.push({ kind: "list", title: "Follow-up Items", items: report.follow_up_items });
            sections.push({ kind: "list", title: "Timeline", items: report.timeline });
            sections.push({ kind: "list", title: "Key Takeaways", items: report.key_takeaways });
            sections.push({ kind: "text", title: "Next Meeting", content: report.next_meeting || "Not specified" });
            sections.push({ kind: "text", title: "Conclusion", content: report.final_conclusion });

            return sections;
      }

      function buildYoutubeSections(report) {
            const sections = [];

            sections.push({
                  kind: "featured",
                  title: report.title,
                  subtitle: report.overview,
                  eyebrow: "YouTube Report",
            });

            sections.push({ kind: "list", title: "Learning Objectives", items: report.learning_objectives });
            sections.push({ kind: "list", title: "Topics Covered", items: report.topics_covered });
            sections.push({ kind: "list", title: "Step-by-step", items: report.step_by_step_explanation });
            sections.push({ kind: "list", title: "Tools Mentioned", items: report.tools_mentioned });
            sections.push({ kind: "list", title: "Important Concepts", items: report.important_concepts });
            sections.push({ kind: "list", title: "Best Practices", items: report.best_practices });
            sections.push({ kind: "list", title: "Mistakes to Avoid", items: report.mistakes_to_avoid });
            sections.push({ kind: "list", title: "Resources Mentioned", items: report.resources_mentioned });
            sections.push({ kind: "list", title: "Key Takeaways", items: report.key_takeaways });

            (report.glossary || []).forEach((g) => {
                  sections.push({ kind: "glossary", title: g.term, content: g.definition });
            });

            sections.push({ kind: "list", title: "Quiz Questions", items: report.quiz_questions });
            sections.push({ kind: "list", title: "Interview Questions", items: report.interview_questions });
            sections.push({ kind: "text", title: "Summary", content: report.final_summary });

            return sections;
      }

      function sectionToCard(section, meta) {
            if (section.kind === "featured") {
                  return PaperCard({
                        variant: "featured",
                        eyebrow: section.eyebrow,
                        title: section.title,
                        subtitle: section.subtitle,
                        meta: meta?.date || undefined,
                        badges: section.badges,
                  });
            }

            if (section.kind === "glossary") {
                  return PaperCard({
                        variant: "glossary",
                        eyebrow: "Glossary",
                        title: section.title,
                        body: section.content,
                  });
            }

            if (section.kind === "text") {
                  return textSection(section.title, section.content);
            }

            if (section.kind === "actions") {
                  const items = section.items || [];
                  if (!items.length) return textSection(section.title, "None noted");
                  return PaperCard({ title: section.title, items });
            }

            return listSection(section.title, section.items);
      }

      function renderReport(report, meta) {
            const isMeeting = report && "executive_summary" in report;
            const sections = isMeeting ? buildMeetingSections(report) : buildYoutubeSections(report);

            const view = el("div", "report-view");
            const masonry = el("div", "report-masonry");

            sections.forEach((section) => {
                  const card = sectionToCard(section, meta);
                  if (section.kind === "featured") {
                        const wrap = el("div", "report-masonry__featured");
                        wrap.appendChild(card);
                        view.appendChild(wrap);
                  } else {
                        masonry.appendChild(card);
                  }
            });

            view.appendChild(masonry);
            return view;
      }

      window.ReportViewer = { render: renderReport, PaperCard };
})();
