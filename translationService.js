/**
 * Serviço de Tradução, Estudo e Exploração Linguística
 * Backend: Pollinations.ai
 * Objetivo: respostas EXATAS, JSON válido e previsibilidade total
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

function normalizarPalavra(palavra) {
  return palavra
    .toLowerCase()
    .replace(/[.,!?;:"'(){}\[\]]/g, "")
    .trim();
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

function extrairJSONSeguro(text) {
  text = text.replace(/```json|```/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  
  // Tenta encontrar array se não achar objeto
  if (start === -1 || end === -1) {
    const startArr = text.indexOf("[");
    const endArr = text.lastIndexOf("]");
    if (startArr !== -1 && endArr !== -1) {
       return JSON.parse(text.slice(startArr, endArr + 1));
    }
    throw new Error("JSON não encontrado");
  }
  return JSON.parse(text.slice(start, end + 1));
}

/* ==========================
   SEGMENTAÇÃO (NOVO)
========================== */

export async function segmentarTexto(texto) {
  checkInternet();

  // Prompt específico para tokenização inteligente em qualquer idioma
  const prompt = encodeURIComponent(`
Analise o texto abaixo e divida-o em tokens/palavras individuais para um dicionário interativo.
IMPORTANTE:
1. Para Árabe, Japonês, Chinês: Separe corretamente por palavras/conceitos, não apenas espaços.
2. Mantenha a pontuação como tokens separados se necessário.
3. Retorne APENAS um Array JSON de strings.

Exemplo Saída: ["Olá", ",", "mundo", "!"]

Texto: "${texto}"
`);

  const url = `https://text.pollinations.ai/${prompt}?seed=${Math.random()}`;

  try {
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) throw new Error("Erro na segmentação");
    const text = await res.text();
    // Tenta extrair array direto ou via função auxiliar
    try {
        return extrairJSONSeguro(text);
    } catch {
        // Fallback: se a IA falhar no JSON, tenta regex simples
        return texto.split(/(\s+|[.,!?;:"()]+)/).filter(t => t.trim().length > 0);
    }
  } catch (e) {
    console.warn("Falha na segmentação via IA, usando fallback local", e);
    return texto.split(/(\s+|[.,!?;:"()]+)/).filter(t => t.trim().length > 0);
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
   OTIMIZAÇÃO PARA TRADUÇÃO
========================== */

export async function otimizarTextoParaTraducao(texto, targetLangCode, userLang = "pt") {
  checkInternet();
  const temp = await traduzir(texto, targetLangCode);
  return traduzir(temp, userLang);
}

/* ==========================
   CORRESPONDÊNCIA (ESTUDO)
========================== */

export async function gerarCorrespondencia(original, traduzido) {
  checkInternet();

  const prompt = encodeURIComponent(`
Gere APENAS JSON válido de correspondência linguística.

Regras:
- Priorize palavras individuais
- Preserve pontuação
- Não explique nada

Formato:
{
  "pairs": [
    { "orig": "texto", "trans": "texto", "type": "word" }
  ]
}

Original: "${original}"
Tradução: "${traduzido}"
`);

  const url = `https://text.pollinations.ai/${prompt}?seed=${Math.random()}`;

  try {
    const res = await fetchWithTimeout(url, 12000);
    if (!res.ok) throw new Error();
    return extrairJSONSeguro(await res.text());
  } catch {
    return { pairs: [] };
  }
}

/* ==========================
   EXPLORADOR DE PALAVRAS (DIDÁTICO)
========================== */

export async function explorarPalavra(
  palavraRaw,
  fraseContexto,
  userLangCode = "pt",
  attempt = 1
) {
  checkInternet();

  const palavra = normalizarPalavra(palavraRaw);
  const idiomaUsuario = LANG_MAP[userLangCode] || "português";

  // Prompt focado em ensino e comparação entre línguas
  // ATUALIZADO: Agora pede "idioma_origem_iso" para o TTS
  const prompt = encodeURIComponent(`
Aja como um professor de idiomas experiente ensinando um falante de ${idiomaUsuario}.

Analise a palavra: "${palavra}"
Dentro da frase: "${fraseContexto}"

OBJETIVO: Explicar o sentido exato desta palavra NESTE contexto específico para o aluno e identificar o idioma da palavra.

Retorne APENAS JSON válido com este formato:
{
  "traducao_contextual": "Tradução direta da palavra para ${idiomaUsuario} neste contexto",
  "explicacao": "Explicação breve (em ${idiomaUsuario}) sobre por que essa palavra foi usada, nuance, tom (formal/informal) ou se é uma expressão.",
  "classe_gramatical": "Classe gramatical (em ${idiomaUsuario})",
  "exemplo_uso": "Uma nova frase curta na língua original usando a palavra",
  "sinonimos": ["sinônimo 1", "sinônimo 2"],
  "idioma_origem_iso": "código ISO de 2-4 letras do idioma da palavra (ex: en-US, pt-BR, es-ES, ja-JP)"
}
`);

  const url = `https://text.pollinations.ai/${prompt}?seed=${Math.random()}`;

  try {
    const res = await fetchWithTimeout(url, 15000);
    if (!res.ok) throw new Error();

    const data = extrairJSONSeguro(await res.text());

    // Validação básica
    if (!data.traducao_contextual || !data.explicacao) {
      throw new Error("JSON incompleto");
    }

    return data;
  } catch (e) {
    if (attempt < 2) {
      return explorarPalavra(palavra, fraseContexto, userLangCode, attempt + 1);
    }

    // Fallback de erro
    return {
      traducao_contextual: palavra,
      explicacao: "Não foi possível carregar a explicação detalhada no momento.",
      classe_gramatical: "Desconhecido",
      exemplo_uso: "",
      sinonimos: [],
      idioma_origem_iso: "en-US" // Fallback padrão
    };
  }
}

