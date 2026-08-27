export const STORNOWAY_PORTAL_URL = "https://confection.svarcpr.com/luce";
export const STORNOWAY_FRAGMENT_PREFIX = "#stornoway=";
export const STORNOWAY_SOURCE = "stornoway";
export const STORNOWAY_PAYLOAD_VERSION = 1;
export const STORNOWAY_SESSION_KEY = "joker-tags-stornoway-lines-v1";

const MAX_TEXT_LENGTH = 160;
const MAX_SIZES = 50;
const MAX_QUANTITY = 100000;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeText(value, maxLength = MAX_TEXT_LENGTH) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength &&
    !Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  );
}

function normalizeSizes(sizes) {
  if (!Array.isArray(sizes) || sizes.length === 0 || sizes.length > MAX_SIZES) {
    return null;
  }

  const counts = {};

  for (const item of sizes) {
    if (!isRecord(item)) return null;
    if (!isSafeText(item.size, 24)) return null;

    const size = item.size.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9 .+/-]*$/.test(size)) return null;
    if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > MAX_QUANTITY) {
      return null;
    }

    counts[size] = (counts[size] || 0) + item.quantity;
  }

  return {
    counts,
    sizes: Object.keys(counts).map((size) => {
      const numericSize = Number(size);
      return Number.isNaN(numericSize) ? size : numericSize;
    }),
  };
}

export function parseStornowayFragment(hash) {
  if (typeof hash !== "string" || !hash.startsWith(STORNOWAY_FRAGMENT_PREFIX)) {
    return { found: false, payload: null, error: null };
  }

  const encoded = hash.slice(STORNOWAY_FRAGMENT_PREFIX.length);
  if (!encoded || encoded.length > 12000) {
    return { found: true, payload: null, error: "Le lien Stornoway est incomplet ou trop long." };
  }

  let candidate;
  try {
    candidate = JSON.parse(decodeURIComponent(encoded));
  } catch {
    return { found: true, payload: null, error: "Le lien Stornoway n’est pas valide." };
  }

  if (!isRecord(candidate)) {
    return { found: true, payload: null, error: "Le lien Stornoway n’est pas valide." };
  }

  const allowedFields = [
    "v",
    "source",
    "lineId",
    "requestNumber",
    "lotNumber",
    "fitName",
    "sizes",
  ];
  if (Object.keys(candidate).some((key) => !allowedFields.includes(key))) {
    return { found: true, payload: null, error: "Le lien Stornoway contient des données inattendues." };
  }

  if (candidate.v !== STORNOWAY_PAYLOAD_VERSION || candidate.source !== STORNOWAY_SOURCE) {
    return { found: true, payload: null, error: "Cette version du lien Stornoway n’est pas reconnue." };
  }

  if (
    !isSafeText(candidate.lineId) ||
    !isSafeText(candidate.requestNumber) ||
    !isSafeText(candidate.lotNumber) ||
    !isSafeText(candidate.fitName)
  ) {
    return { found: true, payload: null, error: "Le lien Stornoway est incomplet." };
  }

  const normalizedSizes = normalizeSizes(candidate.sizes);
  if (!normalizedSizes) {
    return { found: true, payload: null, error: "Les tailles du lien Stornoway ne sont pas valides." };
  }

  return {
    found: true,
    error: null,
    payload: {
      v: STORNOWAY_PAYLOAD_VERSION,
      source: STORNOWAY_SOURCE,
      lineId: candidate.lineId.trim(),
      requestNumber: candidate.requestNumber.trim(),
      lotNumber: candidate.lotNumber.trim(),
      fitName: candidate.fitName.trim(),
      sizes: candidate.sizes.map((item) => ({
        size: item.size.trim().toUpperCase(),
        quantity: item.quantity,
      })),
      counts: normalizedSizes.counts,
      orderedSizes: normalizedSizes.sizes,
    },
  };
}

export function readImportedLineIds(storage) {
  if (!storage) return [];

  try {
    const parsed = JSON.parse(storage.getItem(STORNOWAY_SESSION_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value) => typeof value === "string").slice(-500)
      : [];
  } catch {
    return [];
  }
}

export function rememberImportedLineIds(storage, lineIds) {
  if (!storage) return;

  const next = Array.from(new Set(readImportedLineIds(storage).concat(lineIds))).slice(-500);
  storage.setItem(STORNOWAY_SESSION_KEY, JSON.stringify(next));
}
