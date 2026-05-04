import { useEffect, useMemo, useState } from "react";
import logoUrl from "./assets/logo.svg";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const PAGE = {
  widthIn: 11,
  heightIn: 8.5,
  marginLeftIn: 0.25,
  marginTopIn: 0.25,
  cols: 7,
  rows: 2,
  labelWidthIn: 1.5,
  labelHeightIn: 4.0,
};

const NUMERIC_SIZES = [
  23, 24, 25, 26,
  27, 28, 29, 30, 31, 32, 33, 34,
  36, 38, 40, 42, 44,
];

const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL"];

const FITS = {
  bestie: {
    key: "bestie",
    name: "BESTIE",
    desc: "Mid-rise, barrel leg.\nMi-taille, jambe baril.",
    sizes: NUMERIC_SIZES,
  },
  chore_coat: {
    key: "chore_coat",
    name: "CHORE COAT",
    desc: "Classic workwear coat.\nVeste de travail classique.",
    sizes: LETTER_SIZES,
  },
  denim_jacket: {
    key: "denim_jacket",
    name: "DENIM JACKET",
    desc: "Classic fit.\nFit classique.",
    sizes: LETTER_SIZES,
  },
  groovy_guy: {
    key: "groovy_guy",
    name: "GROOVY GUY",
    desc: "Bootcut, semi-flared leg.\nJambe semi-évasée.",
    sizes: NUMERIC_SIZES,
  },
  wide_wild_west: {
    key: "wide_wild_west",
    name: "WIDE WILD WEST",
    desc: "Mid-rise, wide leg.\nMi-taille, jambe large.",
    sizes: NUMERIC_SIZES,
  },
  true_guy: {
    key: "true_guy",
    name: "TRUE GUY",
    desc: "Straight leg, regular rise.\nJambe droite, taille régulière.",
    sizes: NUMERIC_SIZES,
  },
  super_guy: {
    key: "super_guy",
    name: "SUPER GUY",
    desc: "Regular rise, skinny leg.\nTaille régulière, jambe étroite.",
    sizes: NUMERIC_SIZES,
  },
  easy_guy: {
    key: "easy_guy",
    name: "EASY GUY",
    desc: "Relaxed fit, tapered leg.\nFit relax, jambe fuselée.",
    sizes: NUMERIC_SIZES,
  },
  weird_guy: {
    key: "weird_guy",
    name: "WEIRD GUY",
    desc: "Mid-rise, tapered leg.\nMi-taille, jambe fuselée.",
    sizes: NUMERIC_SIZES,
  },
  strong_guy: {
    key: "strong_guy",
    name: "STRONG GUY",
    desc: "Relaxed straight.\nFit droit décontracté.",
    sizes: NUMERIC_SIZES,
  },
};

const LABELS_PER_PAGE = PAGE.cols * PAGE.rows;
const CUSTOM_FITS_STORAGE_KEY = "joker-tags-custom-fits";

function slugifyFitName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function findFitKeyFromName(fitName) {
  const normalized = fitName.trim().toUpperCase();

  const directMatch = Object.values(FITS).find(
    (fit) => fit.name.toUpperCase() === normalized
  );
  if (directMatch) return directMatch.key;

  const compact = normalized.replace(/\s+/g, "");
  const compactMatch = Object.values(FITS).find(
    (fit) => fit.name.toUpperCase().replace(/\s+/g, "") === compact
  );
  if (compactMatch) return compactMatch.key;

  return slugifyFitName(fitName);
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function labelSlotStyle(index) {
  const col = index % PAGE.cols;
  const row = Math.floor(index / PAGE.cols);

  return {
    position: "absolute",
    left: `${(PAGE.marginLeftIn + col * PAGE.labelWidthIn).toFixed(3)}in`,
    top: `${(PAGE.marginTopIn + row * PAGE.labelHeightIn).toFixed(3)}in`,
    width: `${PAGE.labelWidthIn}in`,
    height: `${PAGE.labelHeightIn}in`,
  };
}

function wrapText(text, maxCharsPerLine = 28) {
  const paragraphs = text.split("\n");
  const lines = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ");
    let current = "";

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (test.length <= maxCharsPerLine) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
    lines.push("");
  }

  if (lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines;
}

async function parsePdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    fullText += strings.join(" ") + "\n";
  }

  return fullText;
}

function extractFitName(text) {
  const normalized = text.replace(/\s+/g, " ").trim().toUpperCase();

  const fitAliases = [
    ["WIDE WILD WEST PANT", "WIDE WILD WEST"],
    ["WIDE WILD WEST", "WIDE WILD WEST"],
    ["SUPERGUY", "SUPER GUY"],
    ["SUPER GUY", "SUPER GUY"],
    ["EASYGUY", "EASY GUY"],
    ["EASY GUY", "EASY GUY"],
    ["TRUEGUY", "TRUE GUY"],
    ["TRUE GUY", "TRUE GUY"],
    ["GROOVYGUY", "GROOVY GUY"],
    ["GROOVY GUY", "GROOVY GUY"],
    ["WEIRDGUY", "WEIRD GUY"],
    ["WEIRD GUY", "WEIRD GUY"],
    ["STRONGGUY", "STRONG GUY"],
    ["STRONG GUY", "STRONG GUY"],
    ["BESTIE", "BESTIE"],
    ["CHORE COAT", "CHORE COAT"],
    ["DENIM JACKET", "DENIM JACKET"],
  ];

  for (const [needle, fitName] of fitAliases) {
    if (normalized.includes(needle)) {
      return fitName;
    }
  }

  return "UNKNOWN";
}

function extractOrderData(text) {
  const fitName = extractFitName(text);
  const normalized = text.replace(/\s+/g, " ").trim();

  const blockMatch = normalized.match(
    /QUANTITÉ\s*\/\s*QUANTITY\s+(.+?)\s+GRANDEUR\s*\/\s*SIZE\s+(.+?)\s+TOTAL\s*:/i
  );

  if (!blockMatch) {
    return { fitName, counts: {} };
  }

  const sizePart = blockMatch[1].trim();
  const qtyPart = blockMatch[2].trim();

  const sizeTokens = sizePart.split(/\s+/).filter(Boolean);
  const qtyTokens = qtyPart
    .split(/\s+/)
    .map(Number)
    .filter((n) => !Number.isNaN(n));

  const counts = {};

  const paddedQtyTokens =
    qtyTokens.length < sizeTokens.length
      ? Array(sizeTokens.length - qtyTokens.length).fill(0).concat(qtyTokens)
      : qtyTokens;

  sizeTokens.forEach((size, i) => {
    const numericSize = Number(size);
    const parsedSize = Number.isNaN(numericSize) ? size.toUpperCase() : numericSize;
    counts[parsedSize] = paddedQtyTokens[i] || 0;
  });

  return { fitName, counts };
}

function printDocument() {
  window.print();
}

function ensurePrintStyles() {
  const existing = document.getElementById("print-style");
  if (existing) return;

  const style = document.createElement("style");
  style.id = "print-style";

  style.innerHTML = `
    @page {
      size: 11in 8.5in;
      margin: 0;
    }

    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        width: 11in !important;
        min-height: 8.5in !important;
        overflow: visible !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      body * {
        visibility: hidden !important;
      }

      #print-root,
      #print-root * {
        visibility: visible !important;
      }

      #print-root {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 11in !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
      }

      .page-break {
        display: block !important;
        width: 11in !important;
        height: 8.5in !important;
        margin: 0 !important;
        padding: 0 !important;
        break-after: page !important;
        page-break-after: always !important;
      }

      #print-root > .page-break:last-child {
        break-after: auto !important;
        page-break-after: auto !important;
      }

      #print-root > .page-break > div {
        border: none !important;
        box-shadow: none !important;
        margin: 0 !important;
      }
    }
  `;

  document.head.appendChild(style);
}

function Label({ fitName, desc, size }) {
  const descLines = wrapText(desc, 30);
  const isLongFit = fitName.length > 12;

  return (
    <div
      style={{
        width: `${PAGE.labelWidthIn}in`,
        height: `${PAGE.labelHeightIn}in`,
        background: "white",
      }}
    >
      <svg
        viewBox="0 0 108 288"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", overflow: "hidden" }}
      >
        <text
          x="57"
          y="36"
          fill="#000"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="5"
          textAnchor="middle"
          dominantBaseline="middle"
          transform="rotate(180 57 36)"
        >
          NAKEDANDFAMOUSDENIM.COM
        </text>

        <text
          x="80"
          y="135"
          fill="#000"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize={isLongFit ? "7.5" : "9"}
          fontWeight="600"
          textAnchor="middle"
          dominantBaseline="middle"
          transform="rotate(180 76 135)"
        >
          {fitName}
        </text>

        <text
          x="16"
          y="135"
          fill="#000"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="9"
          fontWeight="600"
          textAnchor="middle"
          dominantBaseline="middle"
          transform="rotate(180 16 135)"
        >
          {size}
        </text>

        <g transform="translate(0, -12)">
          <text
            x="54"
            y="168"
            fill="#000"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="6.5"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            MADE IN / FAIT AU CANADA
          </text>

          <image
            href={logoUrl}
            x="22.5"
            y="180"
            width="63"
            height="36"
            preserveAspectRatio="xMidYMid meet"
          />

          <line
            x1="4"
            y1="232"
            x2="86"
            y2="232"
            stroke="#000"
            strokeWidth="0.45"
          />

          <text
            x="4"
            y="241.5"
            fill="#000"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="8.3"
            fontWeight="600"
            textAnchor="start"
            dominantBaseline="middle"
          >
            {fitName}
          </text>

          <rect
            x="85"
            y="232"
            width="19"
            height="19"
            fill="none"
            stroke="#000"
            strokeWidth="0.45"
          />

          <text
            x="94.5"
            y="241.5"
            fill="#000"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="8.3"
            fontWeight="600"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {size}
          </text>

          <text
            x="4"
            y="268"
            fill="#000"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="8"
            fontWeight="500"
            textAnchor="start"
          >
            {descLines.map((line, i) => (
              <tspan key={i} x="4" dy={i === 0 ? 0 : "9.0"}>
                {line}
              </tspan>
            ))}
          </text>
        </g>
      </svg>
    </div>
  );
}

function PagePreview({ labels }) {
  return (
    <div
      style={{
        position: "relative",
        background: "white",
        border: "1px solid #d4d4d4",
        width: `${PAGE.widthIn}in`,
        height: `${PAGE.heightIn}in`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        boxSizing: "border-box",
      }}
    >
      {Array.from({ length: LABELS_PER_PAGE }, (_, i) => {
        const label = labels[i];
        if (!label) return null;

        return (
          <div key={i} style={labelSlotStyle(i)}>
            <Label fitName={label.fitName} desc={label.desc} size={label.size} />
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [fitKey, setFitKey] = useState("bestie");
  const [fitQuery, setFitQuery] = useState("");
  const [fitMenuOpen, setFitMenuOpen] = useState(false);

  const [batchJobs, setBatchJobs] = useState([]);
  const [importPreview, setImportPreview] = useState([]);

  const [showNewFitForm, setShowNewFitForm] = useState(false);
  const [newFitName, setNewFitName] = useState("");
  const [newFitDesc, setNewFitDesc] = useState("");
  const [customFits, setCustomFits] = useState({});

  const [isWideScreen, setIsWideScreen] = useState(false);

  useEffect(() => {
    ensurePrintStyles();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsWideScreen(window.innerWidth >= 1400);
    };

    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(CUSTOM_FITS_STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        setCustomFits(parsed);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des fits personnalisés", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CUSTOM_FITS_STORAGE_KEY, JSON.stringify(customFits));
  }, [customFits]);

  const allFits = useMemo(() => {
    return { ...FITS, ...customFits };
  }, [customFits]);

  const fitList = Object.values(allFits);

  const filteredFits = fitList.filter((f) =>
    f.name.toLowerCase().includes(fitQuery.toLowerCase())
  );

  const fit = allFits[fitKey] || FITS.bestie;
  const activeSizes = fit.sizes || NUMERIC_SIZES;

  const [counts, setCounts] = useState(() =>
    Object.fromEntries((FITS.bestie.sizes || NUMERIC_SIZES).map((size) => [size, 0]))
  );

  useEffect(() => {
    setCounts(Object.fromEntries(activeSizes.map((size) => [size, 0])));
  }, [activeSizes]);

  function updateCount(size, value) {
    const numeric = Math.max(0, Number.parseInt(value || "0", 10) || 0);
    setCounts((prev) => ({ ...prev, [size]: numeric }));
  }

  function resetCounts() {
    setCounts(Object.fromEntries(activeSizes.map((size) => [size, 0])));
  }

  function buildJobQueue(job) {
    const queue = [];
    for (const size of job.sizes || []) {
      const count = job.counts[size] || 0;
      for (let i = 0; i < count; i += 1) {
        queue.push({
          fitName: job.fitName,
          desc: job.desc,
          size,
        });
      }
    }
    return queue;
  }

  function addCurrentFitToBatch() {
    const hasAnyQuantity = activeSizes.some((size) => (counts[size] || 0) > 0);
    if (!hasAnyQuantity) return;

    const nextJob = {
      id: `${fitKey}-${Date.now()}`,
      fitKey,
      fitName: fit.name,
      desc: fit.desc,
      counts: { ...counts },
      sizes: [...activeSizes],
    };

    setBatchJobs((prev) => prev.concat(nextJob));
    resetCounts();
  }

  async function handlePdfUpload(e) {
    const files = Array.from(e.target.files).slice(0, 10);
    setImportPreview([]);

    for (const file of files) {
      const text = await parsePdf(file);
      console.log("TEXTE PDF:", text);

      const { fitName, counts: pdfCounts } = extractOrderData(text);
      console.log("PDF ANALYSÉ:", fitName, pdfCounts);

      const fitKey = findFitKeyFromName(fitName);
      const matchedFit = FITS[fitKey] || customFits[fitKey];
      const hasNoCounts = Object.keys(pdfCounts).length === 0;

      const nextJob = {
        id: `${fitName}-${file.name}-${Date.now()}`,
        fitKey,
        fitName: matchedFit && matchedFit.name ? matchedFit.name : fitName,
        desc: matchedFit && matchedFit.desc ? matchedFit.desc : "",
        counts: pdfCounts,
        sizes:
          matchedFit && matchedFit.sizes
            ? matchedFit.sizes
            : Object.keys(pdfCounts).map((v) =>
                Number.isNaN(Number(v)) ? v : Number(v)
              ),
        parseError: hasNoCounts,
      };

      setImportPreview((prev) => [...prev, nextJob]);
    }
  }

  function handleSizeInputKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCurrentFitToBatch();
      setFitQuery("");
      setFitMenuOpen(false);

      const input = document.getElementById("fit-search");
      if (input) input.focus();
    }
  }

  function resetAll() {
    setFitKey("bestie");
    setFitQuery("");
    setFitMenuOpen(false);
    setCounts(
      Object.fromEntries((FITS.bestie.sizes || NUMERIC_SIZES).map((size) => [size, 0]))
    );
    setBatchJobs([]);
  }

  function saveNewFit() {
    const trimmedName = newFitName.trim();
    const trimmedDesc = newFitDesc.trim();

    if (!trimmedName || !trimmedDesc) return;

    const key = slugifyFitName(trimmedName);
    if (!key) return;

    const nextFit = {
      key,
      name: trimmedName.toUpperCase(),
      desc: trimmedDesc,
      sizes: LETTER_SIZES,
    };

    setCustomFits((prev) => ({
      ...prev,
      [key]: nextFit,
    }));

    setFitKey(key);
    setFitQuery(trimmedName.toUpperCase());
    setShowNewFitForm(false);
    setNewFitName("");
    setNewFitDesc("");
  }

  function cancelNewFit() {
    setShowNewFitForm(false);
    setNewFitName("");
    setNewFitDesc("");
  }

  function removeBatchJob(jobId) {
    setBatchJobs((prev) => prev.filter((job) => job.id !== jobId));
  }

  function addExtraLabelsToFillSheet() {
    if (labelsNeededToFillSheet === 0 || batchJobs.length === 0) return;

    const ranked = [];

    for (const job of batchJobs) {
      for (const size of job.sizes || []) {
        const qty = job.counts[size] || 0;
        if (qty <= 0) continue;

        ranked.push({
          job,
          size,
          qty,
        });
      }
    }

    ranked.sort((a, b) => b.qty - a.qty);

    if (ranked.length === 0) return;

    const extrasByJob = {};

    for (let i = 0; i < labelsNeededToFillSheet; i += 1) {
      const pick = ranked[i % ranked.length];
      const jobId = pick.job.id;

      if (!extrasByJob[jobId]) {
        extrasByJob[jobId] = {
          baseJob: pick.job,
          counts: {},
        };
      }

      extrasByJob[jobId].counts[pick.size] =
        (extrasByJob[jobId].counts[pick.size] || 0) + 1;
    }

    const extraJobs = Object.values(extrasByJob).map((group) => ({
      id: `extras-${group.baseJob.id}-${Date.now()}`,
      fitKey: group.baseJob.fitKey,
      fitName: group.baseJob.fitName,
      desc: group.baseJob.desc,
      counts: group.counts,
      sizes: group.baseJob.sizes,
      isExtra: true,
    }));

    setBatchJobs((prev) => prev.concat(extraJobs));
  }

  const batchQueue = useMemo(() => {
    return batchJobs.reduce((acc, job) => acc.concat(buildJobQueue(job)), []);
  }, [batchJobs]);

  const pages = useMemo(() => chunk(batchQueue, LABELS_PER_PAGE), [batchQueue]);
  const totalLabels = batchQueue.length;
  const totalSheets = Math.ceil(totalLabels / LABELS_PER_PAGE);
  const labelsNeededToFillSheet =
    totalLabels % LABELS_PER_PAGE === 0
      ? 0
      : LABELS_PER_PAGE - (totalLabels % LABELS_PER_PAGE);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        color: "#171717",
        padding: "12px",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isWideScreen ? "340px 1fr" : "1fr",
          gap: "24px",
          width: "100%",
        }}
      >
        <aside
          style={{
            background: "#fff",
            borderRadius: "16px",
            border: "1px solid #e5e5e5",
            padding: "20px",
            height: "fit-content",
            position: isWideScreen ? "sticky" : "static",
            top: "24px",
          }}
        >
          <div style={{ marginBottom: "20px" }}>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 600 }}>
              Générateur de joker tags
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#666" }}>
              Prépare les étiquettes par fit pour des feuilles de 14 en format paysage.
            </p>
          </div>

          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={handlePdfUpload}
            style={{ marginTop: "10px" }}
          />

          {importPreview.length > 0 && (
            <div
              style={{
                marginTop: "20px",
                border: "1px solid #ccc",
                padding: "10px",
                borderRadius: "12px",
                background: "#fafafa",
              }}
            >
              <h3 style={{ margin: "0 0 10px", fontSize: "14px" }}>
                Aperçu de l’importation
              </h3>

              {importPreview.map((job) => (
                <div
                  key={job.id}
                  style={{
                    padding: "8px 0",
                    borderTop: "1px solid #eee",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <strong>{job.fitName}</strong>

                    <button
                      type="button"
                      onClick={() =>
                        setImportPreview((prev) =>
                          prev.map((item) =>
                            item.id === job.id
                              ? { ...item, manualOverride: true }
                              : item
                          )
                        )
                      }
                      style={{
                        fontSize: "12px",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Modifier
                    </button>
                  </div>

                  {(job.fitName === "UNKNOWN" || job.manualOverride) && (
                    <select
                      value={job.fitKey || ""}
                      onChange={(e) => {
                        const selectedFitKey = e.target.value;
                        const selectedFit = allFits[selectedFitKey];

                        if (!selectedFit) return;

                        setImportPreview((prev) =>
                          prev.map((item) =>
                            item.id === job.id
                              ? {
                                  ...item,
                                  fitKey: selectedFitKey,
                                  fitName: selectedFit.name,
                                  desc: selectedFit.desc,
                                  sizes: selectedFit.sizes || NUMERIC_SIZES,
                                  parseError: Object.keys(item.counts).length === 0,
                                  manualOverride: false,
                                }
                              : item
                          )
                        );
                      }}
                      style={{
                        marginTop: "6px",
                        width: "100%",
                        padding: "6px",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                      }}
                    >
                      <option value="">Choisir un fit...</option>
                      {fitList.map((fit) => (
                        <option key={fit.key} value={fit.key}>
                          {fit.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {job.parseError ? (
                    <div style={{ color: "#b91c1c", fontSize: "13px", marginTop: "4px" }}>
                      Le PDF n’a pas pu être lu correctement. Vérifier avant d’importer.
                    </div>
                  ) : (
                    <div style={{ marginTop: "4px" }}>
                      {Object.entries(job.counts)
                        .filter(([_, v]) => v > 0)
                        .map(([size, qty]) => `${size}×${qty}`)
                        .join(" • ")}
                    </div>
                  )}
                </div>
              ))}

              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => {
                    const unresolved = importPreview.some((job) => job.fitName === "UNKNOWN");

                    if (unresolved) {
                      alert("Choisir un fit pour chaque item UNKNOWN avant d’importer.");
                      return;
                    }

                    setBatchJobs((prev) => prev.concat(importPreview));
                    setImportPreview([]);
                  }}
                >
                  Confirmer l’importation
                </button>

                <button type="button" onClick={() => setImportPreview([])}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 600,
                  marginBottom: "6px",
                }}
              >
                Fit
              </label>

              <div
                style={{
                  position: "relative",
                  marginBottom: fitMenuOpen ? "220px" : "0",
                }}
              >
                <input
                  id="fit-search"
                  value={fitQuery}
                  onChange={(e) => {
                    setFitQuery(e.target.value);
                    setFitMenuOpen(true);
                  }}
                  onFocus={() => setFitMenuOpen(true)}
                  placeholder="Chercher un fit..."
                  style={{
                    width: "100%",
                    borderRadius: "12px",
                    border: "1px solid #d4d4d4",
                    padding: "10px 12px",
                    background: "#fff",
                    boxSizing: "border-box",
                  }}
                />

                {fitMenuOpen && filteredFits.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "42px",
                      left: 0,
                      right: 0,
                      background: "#fff",
                      border: "1px solid #d4d4d4",
                      borderRadius: "12px",
                      maxHeight: "200px",
                      overflow: "auto",
                      zIndex: 10,
                    }}
                  >
                    {filteredFits.map((item) => (
                      <div
                        key={item.key}
                        onMouseDown={() => {
                          setFitKey(item.key);
                          setFitQuery(item.name);
                          setFitMenuOpen(false);
                        }}
                        style={{
                          padding: "8px 12px",
                          cursor: "pointer",
                          borderBottom: "1px solid #eee",
                          fontSize: "14px",
                        }}
                      >
                        {item.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setShowNewFitForm((prev) => !prev)}
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  background: "#fff",
                  color: "#000",
                  padding: "10px 12px",
                  fontWeight: 500,
                  border: "1px solid #d4d4d4",
                  cursor: "pointer",
                }}
              >
                {showNewFitForm ? "Fermer le nouveau fit" : "Nouveau fit"}
              </button>

              {showNewFitForm && (
                <div
                  style={{
                    borderRadius: "12px",
                    border: "1px solid #e5e5e5",
                    padding: "12px",
                    background: "#fafafa",
                    display: "grid",
                    gap: "10px",
                  }}
                >
                  <input
                    value={newFitName}
                    onChange={(e) => setNewFitName(e.target.value)}
                    placeholder="Nom du fit"
                    style={{
                      width: "100%",
                      borderRadius: "10px",
                      border: "1px solid #d4d4d4",
                      padding: "10px 12px",
                      background: "#fff",
                      boxSizing: "border-box",
                    }}
                  />

                  <textarea
                    value={newFitDesc}
                    onChange={(e) => setNewFitDesc(e.target.value)}
                    placeholder={"Description\nLigne anglaise\nLigne française"}
                    rows={4}
                    style={{
                      width: "100%",
                      borderRadius: "10px",
                      border: "1px solid #d4d4d4",
                      padding: "10px 12px",
                      background: "#fff",
                      resize: "vertical",
                      fontFamily: "Arial, Helvetica, sans-serif",
                      boxSizing: "border-box",
                    }}
                  />

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={saveNewFit}
                      style={{
                        flex: 1,
                        borderRadius: "10px",
                        background: "#000",
                        color: "#fff",
                        padding: "10px 12px",
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Enregistrer le fit
                    </button>

                    <button
                      type="button"
                      onClick={cancelNewFit}
                      style={{
                        flex: 1,
                        borderRadius: "10px",
                        background: "#fff",
                        color: "#000",
                        padding: "10px 12px",
                        fontWeight: 600,
                        border: "1px solid #d4d4d4",
                        cursor: "pointer",
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                borderRadius: "12px",
                border: "1px solid #e5e5e5",
                padding: "12px",
                background: "#fafafa",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "#737373",
                  marginBottom: "8px",
                }}
              >
                Description du fit
              </div>
              <div style={{ fontSize: "14px", fontWeight: 600, whiteSpace: "pre-line" }}>
                {fit.desc}
              </div>
            </div>
          </div>

          <div style={{ marginTop: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>
                Quantités par taille
              </h2>
              <button
                type="button"
                onClick={resetCounts}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#666",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Effacer
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "8px",
                maxHeight: "340px",
                overflowY: "auto",
                paddingRight: "4px",
              }}
            >
              {activeSizes.map((size) => (
                <label
                  key={size}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    borderRadius: "12px",
                    border: "1px solid #e5e5e5",
                    padding: "10px 12px",
                    background: "#fff",
                  }}
                >
                  <span style={{ fontSize: "14px", fontWeight: 600 }}>{size}</span>

                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={counts[size] || 0}
                    onChange={(e) => updateCount(size, e.target.value)}
                    onKeyDown={handleSizeInputKeyDown}
                    style={{
                      width: "56px",
                      borderRadius: "8px",
                      border: "1px solid #d4d4d4",
                      padding: "6px 8px",
                      textAlign: "right",
                    }}
                  />
                </label>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: "20px",
              borderRadius: "12px",
              border: "1px solid #e5e5e5",
              padding: "16px",
              display: "grid",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
              <span>Total d’étiquettes</span>
              <strong>{totalLabels}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
              <span>Total de feuilles</span>
              <strong>{totalSheets || 0}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
              <span>Étiquettes par feuille</span>
              <strong>{LABELS_PER_PAGE}</strong>
            </div>

            {labelsNeededToFillSheet > 0 && (
              <div
                style={{
                  marginTop: "10px",
                  paddingTop: "10px",
                  borderTop: "1px solid #e5e5e5",
                  fontSize: "14px",
                }}
              >
                <div style={{ marginBottom: "8px" }}>
                  Ajouter <strong>{labelsNeededToFillSheet}</strong> étiquettes pour compléter la feuille.
                </div>

                <button
                  type="button"
                  onClick={addExtraLabelsToFillSheet}
                  style={{
                    width: "100%",
                    borderRadius: "10px",
                    background: "#fff",
                    color: "#000",
                    padding: "10px 12px",
                    fontWeight: 600,
                    border: "1px solid #d4d4d4",
                    cursor: "pointer",
                  }}
                >
                  Compléter la feuille automatiquement
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: "20px",
              borderRadius: "12px",
              border: "1px solid #e5e5e5",
              padding: "16px",
              display: "grid",
              gap: "10px",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 700 }}>Liste d’impression</div>

            {batchJobs.length === 0 ? (
              <div style={{ fontSize: "14px", color: "#666" }}>
                Aucun fit ajouté pour le moment.
              </div>
            ) : (
              batchJobs.map((job) => {
                const jobTotal = (job.sizes || []).reduce(
                  (sum, size) => sum + (job.counts[size] || 0),
                  0
                );

                return (
                  <div
                    key={job.id}
                    style={{
                      border: "1px solid #e5e5e5",
                      borderRadius: "10px",
                      padding: "10px 12px",
                      background: "#fff",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600 }}>
                        {job.fitName}
                        {job.isExtra && (
                          <span style={{ fontSize: "11px", color: "#999", fontWeight: 400 }}>
                            {" "}· extra
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: "12px", color: "#666" }}>
                        {jobTotal} étiquettes
                      </div>

                      <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
                        {(job.sizes || [])
                          .filter((size) => job.counts[size] > 0)
                          .map((size) => `${size}×${job.counts[size]}`)
                          .join(" • ")}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeBatchJob(job.id)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#666",
                        cursor: "pointer",
                        fontSize: "13px",
                      }}
                    >
                      Retirer
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
            <button
              type="button"
              onClick={resetAll}
              style={{
                width: "100%",
                borderRadius: "12px",
                background: "#fff",
                color: "#000",
                padding: "12px 14px",
                fontWeight: 600,
                border: "1px solid #d4d4d4",
                cursor: "pointer",
              }}
            >
              Tout effacer
            </button>

            <button
              type="button"
              onClick={addCurrentFitToBatch}
              style={{
                width: "100%",
                borderRadius: "12px",
                background: "#fff",
                color: "#000",
                padding: "14px 16px",
                fontWeight: 600,
                border: "1px solid #d4d4d4",
                cursor: "pointer",
              }}
            >
              Ajouter le fit à la liste
            </button>

            <button
              type="button"
              onClick={printDocument}
              style={{
                width: "100%",
                borderRadius: "12px",
                background: "#000",
                color: "#fff",
                padding: "14px 16px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
            >
              Imprimer / Enregistrer en PDF
            </button>
          </div>
        </aside>

        <main style={{ display: "grid", gap: "16px", width: "100%" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 500 }}>
              Aperçu
            </h2>
          </div>

          <div
            style={{
              overflowX: "auto",
              overflowY: "auto",
              borderRadius: "16px",
              border: "1px solid #e5e5e5",
              background: "#e5e5e5",
              padding: "16px",
            }}
          >
            <div
              id="print-root"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                alignItems: "center",
                minWidth: "max-content",
              }}
            >
              {(pages.length ? pages : [[]]).map((pageSizes, pageIndex) => (
                <div
                  key={pageIndex}
                  className="page-break"
                  style={{ display: "flex", flexDirection: "column", gap: "0" }}
                >
                  <PagePreview labels={pageSizes} />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
