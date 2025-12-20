/**
 * Serviço de Tradução e Processamento de Texto via IA
 * Utiliza a API Pollinations.ai para tradução, análise de contexto e geração de variações.
 */

const LANG_MAP = {
    'ar': 'árabe',
    'pt': 'português',
    'es': 'espanhol',
    'ja': 'japonês',
    'zh': 'chinês',
    'en': 'inglês'
};

function getTranslationTimeout(text) {
    return text.length > 100 ? 10000 : 5000;
}

function checkInternet() {
    if (!navigator.onLine) {
        throw new Error("Sem conexão com a internet. Verifique sua rede.");
    }
}

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 5000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

/**
 * Traduz um texto para o idioma alvo.
 */
export async function traduzir(texto, langCode, tentarNovamente = true) {
    checkInternet();
    const idioma = LANG_MAP[langCode] || langCode; 
    const prompt = encodeURIComponent(`Traduza o seguinte texto para ${idioma}. Produza SOMENTE a tradução, sem explicações. Texto: "${texto}", se necessário, traduza para a frase que mais se encaixa no contexto da frase original`);
    const url = `https://text.pollinations.ai/${prompt}`;
    const timeout = getTranslationTimeout(texto);

    try {
        const res = await fetchWithTimeout(url, { timeout: timeout });
        if (!res.ok) throw new Error("Erro na API de tradução");
        return await res.text();
    } catch (e) {
        if (e.name === 'AbortError') console.warn(`Falha na tradução por timeout (${texto.substring(0, 20)}...)`);
        else console.error("Erro desconhecido na tradução:", e);

        if (tentarNovamente) {
            console.log("Tentando traduzir novamente...");
            return await traduzir(texto, langCode, false);
        }
        throw e;
    }
}

/**
 * Analisa o contexto e intenção de uma mensagem.
 */
export async function analisarContexto(texto, targetLangCode) {
    checkInternet();
    const idioma = LANG_MAP[targetLangCode] || "português";
    const prompt = encodeURIComponent(`Explique de forma curta qual é o provável contexto e intenção da seguinte mensagem. Responda exclusivamente em ${idioma}. Mensagem:"${texto}"`);
    const url = `https://text.pollinations.ai/${prompt}?seed=${Math.random()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Erro ao analisar contexto");
    return await res.text();
}

/**
 * Gera variações criativas de tradução.
 */
export async function gerarVariacoes(texto, targetLangCode, qtd = 3) {
    checkInternet();
    const idioma = LANG_MAP[targetLangCode] || "português";
    const prompt = encodeURIComponent(`gere ${qtd} variações diferentes de tradução para ${idioma} (seja criativo): "${texto}". responda apenas as variações em linhas separadas sem numeração.`);
    const url = `https://text.pollinations.ai/${prompt}?seed=${Math.random()}`;

    try {
        const res = await fetchWithTimeout(url, { timeout: 8000 });
        if (!res.ok) throw new Error("Erro API variações");
        const txt = await res.text();
        return txt.split("\n").filter(l => l.trim().length > 0).map(l => l.replace(/^[-*•]\s*/, ''));
    } catch (e) {
        throw e;
    }
}

/**
 * Otimiza o texto original reescrevendo-o para garantir melhor tradução.
 */
export async function otimizarTextoParaTraducao(texto, targetLangCode, userLangCode = 'pt') {
    checkInternet();

    try {
        const traducaoIntermediaria = await traduzir(texto, targetLangCode);
        const resultadoFinal = await traduzir(traducaoIntermediaria, userLangCode);
        return resultadoFinal;
    } catch (e) {
        console.error("Erro no fluxo de otimização:", e);
        throw e;
    }
}

/**
 * Gera correspondência palavra por palavra para estudo.
 */
export async function gerarCorrespondencia(original, traduzido, targetLangCode) {
    checkInternet();
    
    const prompt = encodeURIComponent(`
Gere um JSON estrito de correspondência linguística.
Regras: Retorne APENAS JSON válido, Preserve pontuação, Priorize palavras individuais.
Formato: { "pairs": [ { "orig": "texto", "trans": "texto", "type": "word" } ] }
Texto original: "${original}"
Tradução: "${traduzido}"
`);

    const url = `https://text.pollinations.ai/${prompt}?seed=${Math.random()}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Erro API");
        const raw = await res.text();
        return parseCorrespondencia(raw, original, traduzido);
    } catch (e) {
        console.error("Erro correspondência:", e);
        return fallbackCorrespondencia(original, traduzido);
    }
}

/**
 * Analisa uma palavra específica no contexto da frase.
 * Retorna classe gramatical, significado e exemplo.
 */
export async function explorarPalavra(palavra, fraseContexto, userLangCode = 'pt') {
    checkInternet();
    const idiomaUsuario = LANG_MAP[userLangCode] || "português";

    const prompt = encodeURIComponent(`
        Atue como um professor de idiomas. Analise a palavra "${palavra}" que aparece na frase: "${fraseContexto}".
        O usuário fala ${idiomaUsuario}.
        Responda EXCLUSIVAMENTE um objeto JSON válido (sem markdown) com os campos traduzidos para ${idiomaUsuario}:
        {
            "classe": "Classe gramatical (em ${idiomaUsuario})",
            "significado": "Definição breve e clara (em ${idiomaUsuario})",
            "sinonimos": "2 ou 3 palavras similares ou sinônimos (em ${idiomaUsuario})",
            "exemplo": "Uma frase de exemplo curta usando esta palavra (em ${idiomaUsuario})"
        }
    `);

    const url = `https://text.pollinations.ai/${prompt}?seed=${Math.random()}`;

    try {
        const res = await fetchWithTimeout(url, { timeout: 8000 });
        if (!res.ok) throw new Error("Erro API Exploração");
        let text = await res.text();
        
        // Limpeza simples para garantir JSON válido caso a IA coloque markdown
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(text);
    } catch (e) {
        console.error("Erro ao explorar palavra:", e);
        // Retorno de fallback caso a API falhe ou o JSON quebre
        return {
            classe: "Desconhecida",
            significado: "Não foi possível carregar a definição detalhada no momento.",
            sinonimos: "-",
            exemplo: "-"
        };
    }
}

// --- Funções Auxiliares Internas ---

function parseCorrespondencia(raw, original, traduzido) {
    try {
        // Tenta limpar markdown se houver
        const cleanRaw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(cleanRaw);

        if (!json.pairs || !Array.isArray(json.pairs)) {
            throw new Error("JSON inválido");
        }
        return json.pairs.filter(p => p.orig && p.trans && p.type);
    } catch (e) {
        console.warn("Fallback ativado");
        return fallbackCorrespondencia(original, traduzido);
    }
}

function tokenize(text) {
    return text.match(/[\p{L}]+|\d+|[^\s\p{L}\d]/gu) || [];
}

function fallbackCorrespondencia(original, traduzido) {
    const o = tokenize(original);
    const t = tokenize(traduzido);
    const len = Math.min(o.length, t.length);

    return Array.from({ length: len }).map((_, i) => ({
        orig: o[i],
        trans: t[i],
        type: /^\d+$/.test(o[i]) ? "number" : /[^\p{L}\d]/u.test(o[i]) ? "punctuation" : "word"
    }));
}