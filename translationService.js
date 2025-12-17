/**
 * translationService.js
 * Módulo responsável por toda a lógica de tradução e interação com APIs de IA.
 * Este arquivo é agnóstico de UI (não manipula o DOM).
 */

const LANG_MAP = {
    'ar': 'árabe',
    'pt': 'português',
    'es': 'espanhol',
    'ja': 'japonês',
    'zh': 'chinês'
};

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Define o timeout baseado no tamanho do texto para evitar cortes prematuros em textos longos.
 */
function getTranslationTimeout(text) {
    return text.length > 100 ? 10000 : 5000;
}

/**
 * Wrapper para fetch com suporte a timeout.
 */
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
 * Traduz um texto para o idioma especificado.
 */
export async function traduzir(texto, langCode, tentarNovamente = true) {
    const idioma = LANG_MAP[langCode] || langCode; 
    const prompt = encodeURIComponent(`traduza apenas para ${idioma}: ${texto}. responda apenas com a tradução o mais fielmente, se o texto já estiver em ${idioma}, responda exatamente o mesmo texto.`);
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

export async function analisarContexto(texto, targetLangCode) {
    const idioma = LANG_MAP[targetLangCode] || "português";
    const prompt = encodeURIComponent(`Explique de forma curta qual é o provável contexto e intenção da seguinte mensagem. Responda exclusivamente em ${idioma}. Mensagem:"${texto}"`);
    const url = `https://text.pollinations.ai/${prompt}?seed=${Math.random()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Erro ao analisar contexto");
    return await res.text();
}

export async function gerarVariacoes(texto, targetLangCode, qtd = 3) {
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