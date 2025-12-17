/**
 * translationService.js
 * Módulo responsável por toda a lógica de tradução e interação com APIs de IA.
 * Este arquivo é agnóstico de UI (não manipula o DOM).
 */

const LANG_MAP = {
    'pt': 'português',
    'ar': 'árabe',
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
    const prompt = encodeURIComponent(`traduza apenas para ${idioma}: ${texto}. responda apenas com a tradução o mais fielmente`);
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
 * Gera um mapa de correspondência palavra-por-palavra.
 */
export async function gerarCorrespondencia(orig, trad) {
    const prompt = encodeURIComponent(`Dado o texto original, gere um JSON estrito com a tradução de cada palavra dele.
  Formato EXATO:
  {
    "map": [
      { "orig": "palavra original", "trans": "palavra traduzida" }
    ]
  }
  Sem comentários, sem explicações.
  
  Original: "${orig}"
  `);

    const url = `https://text.pollinations.ai/${prompt}?seed=${Math.random()}`;
    const res = await fetch(url);
    const txt = await res.text();
    console.log("Mapa de correspondência recebido:", txt);
    
    try {
        return JSON.parse(txt).map;
    } catch (e) {
        const cleanTxt = txt.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanTxt).map;
    }
}

/**
 * Processa o texto e aplica uma função de formatação nas palavras encontradas.
 * Resolve conflitos de sobreposição e evita corrupção de HTML.
 * Esta função constrói uma nova string linearmente para evitar substituições recursivas.
 * @param {string} texto - Texto base (deve ser texto puro, sem tags HTML).
 * @param {Array} map - Array de objetos {orig, trans}.
 * @param {string} side - 'orig' ou 'trans'.
 * @param {Function} formatFn - Função callback(trecho, indexDoMap) => string substituída.
 */
export function processarMarcacao(texto, map, side, formatFn) {
    if (!map || !Array.isArray(map)) return texto;

    const matches = [];
    map.forEach((item, i) => {
        const termo = side === 'orig' ? item.orig : item.trans;
        if (!termo || termo.length < 1) return;
        
        const regex = new RegExp(escapeRegex(termo), 'gi');
        let match;
        // Encontra todas as ocorrências do termo na string original
        while ((match = regex.exec(texto)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                text: match[0],
                index: i
            });
        }
    });

    // Ordena por posição inicial.
    // Lógica crucial: Prioriza matches que aparecem antes. 
    // Em caso de empate no início, prioriza o match mais longo (greedy).
    matches.sort((a, b) => {
        const startDiff = a.start - b.start;
        if (startDiff !== 0) return startDiff;
        return b.end - a.end; // Maior comprimento primeiro se começarem juntos
    });

    let resultado = "";
    let cursor = 0;

    matches.forEach(m => {
        if (m.start < cursor) return; // Ignora se já estiver dentro de um trecho processado (sobreposição)

        // Adiciona texto "normal" antes do match
        resultado += texto.substring(cursor, m.start);
        
        // Adiciona o texto formatado pela função callback
        resultado += formatFn(m.text, m.index);
        
        cursor = m.end;
    });

    // Adiciona o resto do texto
    resultado += texto.substring(cursor);
    return resultado;
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