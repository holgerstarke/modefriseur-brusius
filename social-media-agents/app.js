const STORAGE_KEY = "social_media_agent_knowledge_v1";

const defaultKnowledge = [
  {
    title: "Brand Voice",
    source: "social-media-kit",
    content:
      "Direkt, ehrlich, emotional. Kurze starke Sätze, klare Haltung, keine leeren Floskeln.",
  },
  {
    title: "Instagram Fokus",
    source: "social-media-kit",
    content:
      "Reels-first, Hook in den ersten 1-2 Sekunden, CTA auf Save/Share/Kommentar.",
  },
  {
    title: "Release Funnel",
    source: "social-media-kit",
    content:
      "Tease -> Coming Soon -> Release Day -> Nachlauf mit Community-Reaktionen.",
  },
];

const elements = {
  agentType: document.getElementById("agentType"),
  contentType: document.getElementById("contentType"),
  inputText: document.getElementById("inputText"),
  runAgent: document.getElementById("runAgent"),
  saveInsight: document.getElementById("saveInsight"),
  autoLearning: document.getElementById("autoLearning"),
  agentOutput: document.getElementById("agentOutput"),
  knowledgeTitle: document.getElementById("knowledgeTitle"),
  knowledgeSource: document.getElementById("knowledgeSource"),
  knowledgeContent: document.getElementById("knowledgeContent"),
  addKnowledge: document.getElementById("addKnowledge"),
  exportKnowledgeJson: document.getElementById("exportKnowledgeJson"),
  exportKnowledgeMd: document.getElementById("exportKnowledgeMd"),
  uploadInput: document.getElementById("uploadInput"),
  knowledgeList: document.getElementById("knowledgeList"),
  downloadReport: document.getElementById("downloadReport"),
};

let lastAnalysis = "";
let knowledge = loadKnowledge();

renderKnowledge();

elements.runAgent.addEventListener("click", () => {
  const text = elements.inputText.value.trim();
  if (!text) {
    elements.agentOutput.textContent = "Bitte zuerst Text oder Daten einfügen.";
    return;
  }
  const report = runAnalysis({
    text,
    agent: elements.agentType.value,
    type: elements.contentType.value,
  });
  lastAnalysis = report;
  elements.agentOutput.textContent = report;

  if (elements.autoLearning.checked) {
    storeInsightFromReport(report);
  }
});

elements.saveInsight.addEventListener("click", () => {
  if (!lastAnalysis) {
    elements.agentOutput.textContent = "Keine Analyse vorhanden, die gespeichert werden kann.";
    return;
  }
  storeInsightFromReport(lastAnalysis);
});

elements.addKnowledge.addEventListener("click", () => {
  const title = elements.knowledgeTitle.value.trim() || "Neues Wissen";
  const content = elements.knowledgeContent.value.trim();
  const source = elements.knowledgeSource.value.trim() || "Manuell";
  if (!content) return;
  addKnowledge({ title, source, content });
  elements.knowledgeTitle.value = "";
  elements.knowledgeSource.value = "";
  elements.knowledgeContent.value = "";
});

elements.exportKnowledgeJson.addEventListener("click", () => {
  downloadFile(
    "knowledge-base.json",
    JSON.stringify(knowledge, null, 2),
    "application/json"
  );
});

elements.exportKnowledgeMd.addEventListener("click", () => {
  const lines = ["# Wissensbasis", ""];
  knowledge.forEach((item, idx) => {
    lines.push(`## ${idx + 1}. ${item.title}`);
    lines.push(`- Quelle: ${item.source || "n/a"}`);
    lines.push(`- Zeit: ${item.createdAt || "n/a"}`);
    lines.push("");
    lines.push(item.content);
    lines.push("");
  });
  downloadFile("knowledge-base.md", lines.join("\n"), "text/markdown");
});

elements.downloadReport.addEventListener("click", () => {
  if (!lastAnalysis) {
    elements.agentOutput.textContent = "Bitte zuerst eine Analyse ausführen.";
    return;
  }
  downloadFile(
    `analyse-report-${timestampForFile()}.md`,
    `# Analyse-Report\n\n${lastAnalysis}`,
    "text/markdown"
  );
});

elements.uploadInput.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  const importedTexts = [];
  for (const file of files) {
    const content = await file.text();
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "json") {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          parsed.forEach((entry) => {
            if (entry && typeof entry === "object") {
              addKnowledge({
                title: String(entry.title || "Importierter Datensatz"),
                source: String(entry.source || file.name),
                content: String(entry.content || JSON.stringify(entry)),
                silent: true,
              });
            }
          });
        } else {
          addKnowledge({
            title: `JSON Import: ${file.name}`,
            source: file.name,
            content: JSON.stringify(parsed, null, 2),
            silent: true,
          });
        }
      } catch {
        addKnowledge({
          title: `Import: ${file.name}`,
          source: file.name,
          content,
          silent: true,
        });
      }
    } else if (extension === "csv") {
      addKnowledge({
        title: `CSV Import: ${file.name}`,
        source: file.name,
        content,
        silent: true,
      });
    } else {
      addKnowledge({
        title: `Import: ${file.name}`,
        source: file.name,
        content,
        silent: true,
      });
    }
    importedTexts.push(`\n\n--- Datei: ${file.name} ---\n${content}`);
  }

  elements.inputText.value = `${elements.inputText.value}${importedTexts.join("")}`.trim();
  elements.agentOutput.textContent =
    `Upload erfolgreich (${files.length} Datei(en)). Wissen aktualisiert und Inhalt ins Analysefeld übernommen.`;
  elements.uploadInput.value = "";
});

function runAnalysis({ text, agent, type }) {
  const normalized = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const hashtags = text.match(/#[\p{L}\p{N}_-]+/gu) || [];
  const mentions = text.match(/@[\p{L}\p{N}_.-]+/gu) || [];
  const ctaKeywords = ["kommentier", "teile", "speicher", "like", "folge", "abonniere"];
  const ctaHits = ctaKeywords.filter((k) => normalized.includes(k));
  const positiveWords = ["stark", "danke", "liebe", "weiter", "hoffnung", "krone"];
  const negativeWords = ["problem", "hass", "angst", "pause", "sperr", "verlust"];
  const pos = positiveWords.filter((w) => normalized.includes(w)).length;
  const neg = negativeWords.filter((w) => normalized.includes(w)).length;

  const sentiment =
    pos === neg ? "neutral" : pos > neg ? "positiv/aufbauend" : "kritisch/angespannt";

  const agentFocus = {
    content: "Hook, Storyline, Caption-Struktur und Wiedererkennbarkeit",
    reach: "Watchtime, Shareability, Hashtag-Mix und CTA-Klarheit",
    community: "Dialogfähigkeit, Tonalität und Kommentar-Strategie",
    profile: "Positionierung, Bio-Klarheit, Konsistenz über Plattformen",
  }[agent];

  const typeHints = {
    post: "Post sollte in den ersten 2 Zeilen den Kernkonflikt nennen.",
    video: "Video/Reel braucht Pattern Break in den ersten 2 Sekunden.",
    comment: "Kommentare nach Themen clustern (Support, Kritik, Fragen).",
    profile: "Profiltext muss in einem Satz Positionierung + Mehrwert liefern.",
  }[type];

  const strengths = [];
  if (hashtags.length >= 5) strengths.push("Hashtag-Basis vorhanden.");
  if (mentions.length) strengths.push("Verlinkungen für Netzwerk-Effekt enthalten.");
  if (ctaHits.length) strengths.push("Call-to-Action ist erkennbar.");
  if (words.length > 25) strengths.push("Genug Inhalt für Storytelling.");

  const risks = [];
  if (!ctaHits.length) risks.push("Keine klare Handlungsaufforderung (CTA).");
  if (hashtags.length > 15) risks.push("Zu viele Hashtags können wie Spam wirken.");
  if (words.length < 12) risks.push("Zu kurzer Inhalt für starke emotionale Bindung.");
  if (!mentions.length && type !== "profile") risks.push("Keine Cross-Promo/Tagging-Signale.");

  const actions = [
    "Hook-Zeile schärfen: Konflikt + Haltung in 8-12 Wörtern.",
    "Eine konkrete CTA-Formulierung ergänzen (z. B. 'Schreib Weiter').",
    "Kommentar-Pin vorbereiten, um Diskussion gezielt zu starten.",
  ];
  if (type === "video") actions.push("Untertitel und harten Schnitt in den ersten Sekunden nutzen.");
  if (type === "profile") actions.push("Bio auf 1 Satz Positionierung + 1 Satz sozialer Beweis reduzieren.");

  const usedKnowledge = sampleKnowledge(3).map((k) => `- ${k.title}: ${k.content}`);
  const date = new Date().toLocaleString("de-DE");

  return [
    `## Agent Report (${date})`,
    `Agent: ${agent}`,
    `Inhaltstyp: ${type}`,
    "",
    "### Schnellmetriken",
    `- Wörter: ${words.length}`,
    `- Hashtags: ${hashtags.length}`,
    `- Mentions: ${mentions.length}`,
    `- CTA-Treffer: ${ctaHits.length ? ctaHits.join(", ") : "keine"}`,
    `- Stimmungsbild: ${sentiment}`,
    "",
    "### Fokus",
    `- ${agentFocus}`,
    `- ${typeHints}`,
    "",
    "### Stärken",
    ...(strengths.length ? strengths.map((s) => `- ${s}`) : ["- Noch keine klaren Stärken erkannt."]),
    "",
    "### Risiken",
    ...(risks.length ? risks.map((r) => `- ${r}`) : ["- Keine kritischen Risiken erkannt."]),
    "",
    "### Nächste Schritte",
    ...actions.map((a) => `- ${a}`),
    "",
    "### Eingeblendetes Wissen",
    ...(usedKnowledge.length ? usedKnowledge : ["- Kein Wissen verfügbar."]),
  ].join("\n");
}

function storeInsightFromReport(report) {
  const short = report.split("\n").slice(0, 18).join(" ").slice(0, 700);
  addKnowledge({
    title: `Insight ${new Date().toLocaleDateString("de-DE")}`,
    source: "Analyse",
    content: short,
  });
  elements.agentOutput.textContent += "\n\n[WISSEN] Insight wurde gespeichert.";
}

function addKnowledge({ title, source, content, silent = false }) {
  knowledge.unshift({
    title,
    source,
    content,
    createdAt: new Date().toISOString(),
  });
  knowledge = knowledge.slice(0, 500);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(knowledge));
  renderKnowledge();
  if (!silent) {
    elements.agentOutput.textContent = "Wissen erfolgreich gespeichert.";
  }
}

function loadKnowledge() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [...defaultKnowledge];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : [...defaultKnowledge];
  } catch {
    return [...defaultKnowledge];
  }
}

function sampleKnowledge(limit = 3) {
  return knowledge.slice(0, Math.min(limit, knowledge.length));
}

function renderKnowledge() {
  elements.knowledgeList.innerHTML = "";
  knowledge.slice(0, 20).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.title} — ${item.source || "n/a"}`;
    elements.knowledgeList.appendChild(li);
  });
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function timestampForFile() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}
