/**
 * Serviço de Tradução Simplificado
 * Backend: Pollinations.ai
 * Funcionalidades: Tradução, Variações, Contexto e Reformulação
 */

/* ==========================
   MAPAS E UTILITÁRIOS
========================== */

const LANG_MAP = {
  ar: "árabe",
  pt: "português",
  es: "espanhol",
  ja: "japonês",
  zh: "chinês",
  en: "inglês"
};

function checkInternet() {
  if (!navigator.onLine) {
    throw new Error("Sem conexão com a internet");
  }
}

function getTimeoutBySize(text) {
  return text.length > 120 ? 12000 : 6000;
}

async function fetchWithTimeout(url, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

/* ==========================
   TRADUÇÃO
========================== */

export async function traduzir(texto, langCode, retry = true) {
  checkInternet();

  const idioma = LANG_MAP[langCode] || langCode;
  const prompt = encodeURIComponent(
    `Traduza o texto a seguir para ${idioma}. 
Produza SOMENTE a tradução, sem comentários ou explicações.

Texto: "${texto}"`
  );

  const url = `https://text.pollinations.ai/${prompt}`;
  const timeout = getTimeoutBySize(texto);

  try {
    const res = await fetchWithTimeout(url, timeout);
    if (!res.ok) throw new Error("Erro na API");
    return (await res.text()).trim();
  } catch (e) {
    if (retry) return traduzir(texto, langCode, false);
    throw e;
  }
}

/* ==========================
   CONTEXTO
========================== */

export async function analisarContexto(texto, targetLangCode) {
  checkInternet();

  const idioma = LANG_MAP[targetLangCode] || "português";
  const prompt = encodeURIComponent(
    `Explique de forma OBJETIVA o contexto e a intenção da frase abaixo.
Responda SOMENTE em ${idioma}.

Frase: "${texto}"`
  );

  const url = `https://text.pollinations.ai/${prompt}?seed=${Math.random()}`;
  const res = await fetchWithTimeout(url, 10000);
  if (!res.ok) throw new Error("Erro contexto");
  return (await res.text()).trim();
}

/* ==========================
   VARIAÇÕES
========================== */

export async function gerarVariacoes(texto, targetLangCode, qtd = 3) {
  checkInternet();

  const idioma = LANG_MAP[targetLangCode] || "português";
  const prompt = encodeURIComponent(
    `Gere ${qtd} variações DIFERENTES e naturais da tradução abaixo para ${idioma}.
Responda apenas com as frases, uma por linha, sem numeração.

Texto: "${texto}"`
  );

  const url = `https://text.pollinations.ai/${prompt}?seed=${Math.random()}`;
  const res = await fetchWithTimeout(url, 9000);
  if (!res.ok) throw new Error("Erro variações");

  return (await res.text())
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
}

/* ==========================
   OTIMIZAÇÃO PARA TRADUÇÃO (REFORMULAÇÃO)
========================== */

export async function otimizarTextoParaTraducao(texto, targetLangCode, userLang = "pt") {
  checkInternet();
  const temp = await traduzir(texto, targetLangCode);
  return traduzir(temp, userLang);
}