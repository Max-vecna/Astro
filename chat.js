// chat.js
// Gerencia envio, renderização, tradução e TTS de mensagens com persistência de estado de erro

import { db } from './config.js';
import { state } from './state.js';
import { DOMElements } from './dom.js';
import * as Utils from './utils.js';
import * as Services from './services.js';
import * as Modals from './modals.js';
import { ref, push, set, update, get, query, limitToLast, orderByKey } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// --- Envio de Mensagens ---
export const sendMessage = async (overrideText = null) => {
    // Permite enviar texto passado por parâmetro (útil para as sugestões)
    const text = overrideText || DOMElements.messageInput.value.trim();
    if (!text || !state.currentRoom) return;
 
    const payload = {
        text,
        nickname: state.nickname,
        userId: state.userId,
        timestamp: Date.now()
    };
 
    if (state.replyingToMessage) {
        payload.repliedTo = {
            msgId: state.replyingToMessage.msgId,
            nickname: state.replyingToMessage.nickname,
            text: state.replyingToMessage.text
        };
    }
 
    await push(ref(db, `messages/${state.currentRoom}`), payload);

    await set(ref(db, `typing/${state.currentRoom}/${state.userId}`), null);

    if (!overrideText) DOMElements.messageInput.value = '';
    clearReply();

    // === Lógica de Resposta da IA (Modo Mentor) ===
    if (state.isAiRoom) {
        triggerAiResponse(text);
    }
};

const triggerAiResponse = async (userText) => {
    const aiId = 'AI_BOT';
    const typingRef = ref(db, `typing/${state.currentRoom}/${aiId}`);
    
    setTimeout(() => {
        set(typingRef, { nickname: 'Astro Mentor', text: 'Digitando...' });
    }, 600);

    try {
        const msgsRef = query(ref(db, `messages/${state.currentRoom}`), orderByKey(), limitToLast(6));
        const snap = await get(msgsRef);
        const history = [];
        snap.forEach(c => {
            const v = c.val();
            history.push({ role: v.userId === aiId ? 'Astro Mentor' : 'User', text: v.text });
        });

        // Agora esperamos um objeto { text, suggestions }
        const responseObj = await Services.conversarComIA(history, state.currentTranslationLangGlobal);

        await set(typingRef, null);
        
        // Salvamos as sugestões junto com a mensagem no Firebase
        await push(ref(db, `messages/${state.currentRoom}`), {
            text: responseObj.text || responseObj, // Fallback se vier string pura
            suggestions: responseObj.suggestions || [],
            nickname: 'Astro Mentor',
            userId: aiId,
            timestamp: Date.now()
        });

    } catch (e) {
        set(typingRef, null);
    }
};

export const startReply = (msgId, text) => {
    const msgEl = document.querySelector(`.message-wrapper[data-msg-id="${msgId}"]`);
    if (!msgEl) return;

    const nicknameEl = msgEl.querySelector('.nickname-display');
    const nickname = nicknameEl ? nicknameEl.textContent : 'Você';

    state.replyingToMessage = { msgId, nickname, text };

    DOMElements.replyPreview.innerHTML = `
        <div class="flex justify-between items-start gap-2">
            <div class="flex-1">
                <div class="text-xs font-bold opacity-80">${nickname}</div>
                <div class="text-xs truncate opacity-70">${text}</div>
            </div>
            <button id="cancel-reply" class="text-xs opacity-60 hover:opacity-100">&times;</button>
        </div>
    `;
    DOMElements.replyPreview.classList.remove('hidden');
    document.getElementById('cancel-reply').onclick = clearReply;
    DOMElements.messageInput.focus();
};

export const clearReply = () => {
    state.replyingToMessage = null;
    DOMElements.replyPreview.classList.add('hidden');
    DOMElements.replyPreview.innerHTML = '';
};

export async function updateMessageText(msgId, newText) {
    if (!state.currentRoom || !msgId || !newText.trim()) return;

    const msgRef = ref(db, `messages/${state.currentRoom}/${msgId}`);

    await update(msgRef, {
        text: newText.trim(),
        timestamp: Date.now(),
        hasError: null 
    });
}

// --- Renderização ---
export const renderTypingIndicator = (typingUsers) => {
    const container = DOMElements.typingIndicatorContainer;
    container.innerHTML = '';
    Object.entries(typingUsers).forEach(([typingUserId, userData]) => {
        if (!userData || !userData.nickname) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-start mb-2 animate-pulse max-w-[80%]';
        wrapper.innerHTML = `<div class="text-xs text-muted-color mb-1 ml-2">${userData.nickname} digitando...</div><div class="chat-bubble bg-[var(--bubble-other-bg)] text-[var(--bubble-other-text)] rounded-2xl py-2 px-4 opacity-70 italic text-sm border border-white/10">${userData.text || '...'}</div>`;
        container.appendChild(wrapper);
    });
    if (Object.keys(typingUsers).length > 0) Utils.scrollToBottom();
};

function applyErrorState(wrapper) {
    if (!wrapper) return;
    wrapper.dataset.hasCorrection = "true";
    wrapper.classList.add('has-correction');
    wrapper.classList.add('locked-error');
}

export const renderMessage = (msgData, msgId) => {
    if (!msgData || !msgData.text) return;

    const existingMsgEl = document.querySelector(`.message-wrapper[data-msg-id="${msgId}"]`);
    const isSelf = msgData.userId === state.userId;
    const isSameUserAsPrevious = state.lastRenderedUserId === msgData.userId;

    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message-wrapper items-${isSelf ? 'end' : 'start'} bublle`;
    messageWrapper.dataset.msgId = msgId;
    messageWrapper.dataset.userId = msgData.userId;
    
    if (msgData.hasError) {
        applyErrorState(messageWrapper);
    }

    if (existingMsgEl && existingMsgEl.classList.contains('grouped-message')) {
        messageWrapper.classList.add('grouped-message');
    } else if (!existingMsgEl && isSameUserAsPrevious) {
        messageWrapper.classList.add('grouped-message');
    }

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble selectable-text';

    if (!state.userColors[msgData.userId]) state.userColors[msgData.userId] = `hsl(${Math.random() * 360}, 70%, 60%)`;

    let contentHTML = '';
    if (msgData.repliedTo) {
       contentHTML += `<div class="mb-2 pl-2 border-l-2 border-white/30 text-xs opacity-70"><strong class="block" style="white-space: nowrap;">${msgData.repliedTo.nickname}</strong><span class="truncate block max-w-[200px]">${msgData.repliedTo.text}</span></div>`;
    }

    const showName = !isSelf && (!existingMsgEl ? !isSameUserAsPrevious : !messageWrapper.classList.contains('grouped-message'));

    if (showName) {
        const isAI = msgData.userId === 'AI_BOT';
        contentHTML += `<div class="nickname-display text-xs font-bold mb-1 opacity-90"
            style="color: ${isAI ? '#a78bfa' : state.userColors[msgData.userId]};">
            ${isAI ? '<i class="fas fa-robot mr-1"></i>' : ''}${msgData.nickname}
        </div>`;
    }

    const safeText = msgData.text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');
    const translationId = `trans-${msgId}`;
    
    if (state.isAiRoom) {
         contentHTML += `
            <div class="original-text" style="font-size: 1rem; font-style: normal; opacity: 1; border: none; padding-top: 0;">${safeText}</div>
            
            <div class="flex items-center gap-2 mt-1 opacity-50 hover:opacity-100 transition-opacity">
                 <button class="speak-btn text-xs hover:text-white" title="Ouvir" onclick="window.Chat.speakText('${msgId}')">
                    <i class="fas fa-volume-high"></i>
                </button>
            </div>
            <div id="${translationId}" class="translated-text hidden text-xs text-yellow-300 mt-2 border-t border-white/10 pt-2"></div>
        `;
        
        // === RENDERIZAR SUGESTÕES DE RESPOSTA ===
        if (msgData.suggestions && Array.isArray(msgData.suggestions) && msgData.suggestions.length > 0) {
            contentHTML += `<div class="suggestions-list">`;
            msgData.suggestions.forEach((sug, index) => {
                // Usamos um atributo data-suggestion para recuperar no click event abaixo
                contentHTML += `<button class="suggestion-pill" data-suggestion="${sug}">${sug}</button>`;
            });
            contentHTML += `</div>`;
        }

    } else {
        // Layout Padrão com Tradução
        let currentTrans = '';
        let textChanged = false;

        if (existingMsgEl) {
            const oldOriginalEl = existingMsgEl.querySelector('.original-text');
            if (oldOriginalEl && oldOriginalEl.innerText.replace(/<br>/g, '\n').trim() !== msgData.text.trim()) {
                textChanged = true;
            } else {
                const oldTransEl = existingMsgEl.querySelector('.translated-text');
                if (oldTransEl) currentTrans = oldTransEl.innerHTML;
            }
        }

        contentHTML += `
        <div class="flex items-start gap-2">
            <div id="${translationId}" class="translated-text flex-1">
                ${currentTrans ? currentTrans.trim().trimStart() : ''}
            </div>
            <button class="speak-btn text-xs opacity-60 hover:opacity-100 transition" title="Ouvir tradução" data-msg-id="${msgId}">
                <i class="fas fa-volume-high"></i>
            </button>
        </div>
        <div class="original-text">${safeText}</div>
        `;
    }

    const time = new Date(msgData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const meta = document.createElement('div');
    meta.className = `message-meta ${isSelf ? 'meta-self' : 'meta-other'}`;
    meta.innerHTML = `<span class="message-time">${time}</span>`;

    bubble.innerHTML = contentHTML;
    
    // Event Listeners para os botões de sugestão
    // Precisamos fazer isso ANTES de adicionar ao DOM ou usar delegação no messageWrapper
    // Aqui adicionamos ao bubble, mas o bubble é HTML string até agora.
    // Vamos adicionar listeners após o append.

    if (!state.isAiRoom) {
        const speakBtn = bubble.querySelector('.speak-btn');
        if (speakBtn) {
            speakBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopImmediatePropagation(); });
            speakBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); speakTranslatedMessage(msgId); });
        }
    }

    if(!isSelf) {
        messageWrapper.appendChild(bubble);
        messageWrapper.appendChild(meta);
    } else {
        messageWrapper.appendChild(meta);
        messageWrapper.appendChild(bubble);
    }

    // Adicionar Listener de Sugestões (Delegation dentro do bubble)
    bubble.addEventListener('click', (e) => {
        const sugBtn = e.target.closest('.suggestion-pill');
        if (sugBtn) {
            e.stopPropagation();
            const text = sugBtn.dataset.suggestion;
            sendMessage(text); // Envia direto
            return;
        }

        if (e.target.closest('.speak-btn')) return;
        if (window.getSelection().toString().length > 0) return;
        openActionsMenu(bubble, msgId, msgData.text);
    });


    if (existingMsgEl) {
        DOMElements.messagesList.replaceChild(messageWrapper, existingMsgEl);
        if (!state.isAiRoom && textChanged) {
            performTranslation(msgId, msgData.text, state.currentTranslationLang);
        }

    } else {
        DOMElements.messagesList.insertBefore(messageWrapper, DOMElements.typingIndicatorContainer);
        Utils.scrollToBottom();
        if (!state.isAiRoom) {
            performTranslation(msgId, msgData.text, state.currentTranslationLang);
        }
    }

    // === REAÇÕES ===
    if (msgData.reactions) {
        const reactionsBar = document.createElement("div");
        reactionsBar.className = "reaction-bar";

        Object.entries(msgData.reactions).forEach(([emoji, users]) => {
            const count = Object.keys(users || {}).length;
            if (count === 0) return;

            const btn = document.createElement("button");
            btn.className = "reaction-pill";
            btn.textContent = `${emoji} ${count}`;

            if (users[state.userId]) {
                btn.classList.add("active");
                messageWrapper.dataset[`react_${emoji}`] = "true";
            }

            btn.addEventListener("mousedown", e => e.stopPropagation());
            btn.addEventListener("click", e => {
                e.stopPropagation();
                toggleReaction(msgId, emoji);
            });

            reactionsBar.appendChild(btn);
        });

         meta.appendChild(reactionsBar);
    }

    state.lastRenderedUserId = msgData.userId;
};

// --- Tradução ---
export const performTranslation = async (msgId, originalText, lang) => {
    if (state.isAiRoom) return;

    const el = document.getElementById(`trans-${msgId}`);
    if (!el) return;

    const wrapper = el.closest('.message-wrapper');
    const speakBtn = wrapper?.querySelector('.speak-btn');

    if (speakBtn && el.textContent.trim() === '') {
        speakBtn.classList.remove('ready');
    }

    el.classList.add('loading');
    el.innerHTML = '<i class="fas fa-circle-notch fa-spin text-xs opacity-50"></i>';

    try {
        const result = await Services.traduzir(originalText, lang);

        const translatedText =
            typeof result === 'string' ? result : result.texto;

        const hasCorrection =
            typeof result === 'object' && result.temErro === true;

        el.classList.remove('loading');

        el.textContent = translatedText;

        if (speakBtn && !hasCorrection) {
            speakBtn.classList.add('ready');
        }

        const wrapper = el.closest('.message-wrapper');
        const msgUserId = wrapper.dataset.userId;
        const isOwner = state.userId === msgUserId;

        const alreadyHasError = wrapper.dataset.hasCorrection === "true";

        if (alreadyHasError) {
            wrapper.classList.add('has-correction');
            return;
        }

        if (hasCorrection) {
            applyErrorState(wrapper);

            if (isOwner) {
                const msgRef = ref(db, `messages/${state.currentRoom}/${msgId}`);
                update(msgRef, { hasError: true });
            }
            return;
        }

        const origEl = el.nextElementSibling;
        if (origEl && origEl.classList.contains('original-text')) {
            if (
                translatedText.trim().toLowerCase() ===
                originalText.trim().toLowerCase()
            ) {
                origEl.style.display = 'none';
                el.style.marginBottom = '0';
            } else {
                origEl.style.display = 'block';
            }
        }

    } catch (err) {
        el.classList.remove('loading');
        if (speakBtn) speakBtn.classList.remove('ready');
         el.style.display = 'none';
    }
};


export const retranslateAllMessages = (newLang) => {
    if(state.isAiRoom) return;
    Utils.showToast(`Traduzindo para ${newLang.toUpperCase()}...`, 'info');
    document.querySelectorAll('.message-wrapper').forEach(wrapper => {
        const msgId = wrapper.dataset.msgId;
        const originalTextEl = wrapper.querySelector('.original-text');
        if (originalTextEl && msgId) performTranslation(msgId, originalTextEl.innerText, newLang);
    });
};

// --- TTS ---
function setSpeakIdle(msgId) {
    const btn = document.querySelector(`.speak-btn[data-msg-id="${msgId}"] i`);
    if (btn) btn.className = 'fas fa-volume-high';
}

function setSpeakLoading(msgId) {
    const btn = document.querySelector(`.speak-btn[data-msg-id="${msgId}"] i`);
    if (btn) btn.className = 'fas fa-circle-notch fa-spin';
}

async function speakTranslatedMessage(msgId) {
    const transEl = document.getElementById(`trans-${msgId}`);
    if (!transEl) return;
    const text = transEl.textContent.replace(/\s+/g, ' ').trim();
    if (!text || text.length < 2) return;
    speakGeneric(text, msgId);
}

window.Chat = window.Chat || {};
window.Chat.speakText = (msgId) => {
    const wrapper = document.querySelector(`.message-wrapper[data-msg-id="${msgId}"]`);
    if(!wrapper) return;
    const text = wrapper.querySelector('.original-text').innerText;
    speakGeneric(text, msgId);
};

// Modificada para aceitar um botão genérico para loading (útil para o botão de seleção)
async function speakGeneric(text, msgId = null, btnElement = null) {
    if(msgId) setSpeakLoading(msgId);
    if(btnElement) {
        const i = btnElement.querySelector('i');
        if(i) i.className = 'fas fa-circle-notch fa-spin';
    }

    speechSynthesis.cancel();

    let detectedLang = null;
    try {
        const detectionResult = await Services.detectarIdioma(text);
        detectedLang = typeof detectionResult === 'string' ? detectionResult : detectionResult?.lang;
    } catch (err) {}

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = detectedLang || 'en-US';
    utterance.rate = 0.9;

    const resetUI = () => {
        if(msgId) setSpeakIdle(msgId);
        if(btnElement) {
            const i = btnElement.querySelector('i');
            if(i) i.className = 'fas fa-volume-high';
        }
    };

    utterance.onstart = resetUI;
    utterance.onend = resetUI;
    utterance.onerror = resetUI;

    speechSynthesis.speak(utterance);
}


function openReactionPicker(msgId) {
    const emojis = ['👍','😂','🔥','❤️','😮','😢','👏'];

    const menu = document.createElement('div');
    menu.className = 'reaction-picker';

    emojis.forEach(e => {
        const btn = document.createElement('button');
        btn.textContent = e;
        btn.onclick = () => {
            toggleReaction(msgId, e);
            menu.remove();
        };
        menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    const wrapper = document.querySelector(`[data-msg-id="${msgId}"]`);
    const bubble = wrapper.querySelector('.chat-bubble');
    const rect = bubble.getBoundingClientRect();
    const isSelf = wrapper.classList.contains('items-end');
    const top = rect.bottom + 6;
    let left;
    if (isSelf) {
        left = rect.right - menu.offsetWidth;
    } else {
        left = rect.left;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - menu.offsetWidth - 8));

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    setTimeout(() => {
        document.addEventListener("click", () => menu.remove(), { once: true });
    }, 50);
}


// --- Menu de Ações ---
const openActionsMenu = (triggerEl, msgId, text) => {
    const wrapper = document.querySelector(`.message-wrapper[data-msg-id="${msgId}"]`);
    if (!wrapper) return;

    const hasCorrection = wrapper.dataset.hasCorrection === "true";
    const msgUserId = wrapper.dataset.userId;
    const isOwner = msgUserId === state.userId;

    if (hasCorrection && !isOwner) {
        Utils.showToast("Aguardando correção do autor.", "info");
        return;
    }

    if(state.activeMessageMenu) state.activeMessageMenu.remove();
    
    const menu = document.createElement('div');
    menu.className = 'options-menu';
    
    let options = [];

    if (state.isAiRoom) {
         options = [
            { icon: 'fa-copy', label: 'Copiar', action: () => navigator.clipboard.writeText(text) },
            { icon: 'fa-graduation-cap', label: 'Estudar Frase', class: 'opt-study', action: () => Modals.openStudyModal(text) },
            { icon: 'fa-globe', label: 'Traduzir manualmente', action: () => Modals.openTranslateToModal(text) }
         ];
    } else {
        options = hasCorrection
        ? [
            { icon: 'fa-pen', label: 'Corrigir mensagem', action: () => Modals.openEditMessageModal(msgId, text) }
          ]
        : [
            { icon: 'fa-reply', label: 'Responder', action: () => startReply(msgId, text) },
            { icon: 'fa-language', label: 'Retraduzir', class: 'opt-translate', action: () => Modals.handleAction('translate', text, msgId) },
            { icon: 'fa-globe', label: 'Traduzir para...', action: () => Modals.openTranslateToModal(text) },
            { icon: 'fa-lightbulb', label: 'Contexto', class: 'opt-context', action: () => Modals.handleAction('context', text, msgId) },
            { icon: 'fa-graduation-cap', label: 'Estudar', class: 'opt-study', action: () => Modals.handleAction('study', text, msgId) },
            { icon: 'fa-random', label: 'Variações', class: 'opt-vars', action: () => Modals.handleAction('variations', text, msgId) },
            { icon: 'fa-copy', label: 'Copiar', action: () => navigator.clipboard.writeText(text) },
            {
                icon: 'fa-face-smile',
                label: 'Reagir',
                action: () => openReactionPicker(msgId)
            }
        ];
    }

    options.forEach(opt => {
        const item = document.createElement('div');
        item.className = `options-item ${opt.class || ''}`;
        item.innerHTML = `<i class="fas ${opt.icon}"></i> ${opt.label}`;
        item.onclick = (e) => { e.stopPropagation(); opt.action(); menu.remove(); state.activeMessageMenu = null; };
        menu.appendChild(item);
    });

    document.body.appendChild(menu);
    menu.classList.add('show'); 
    state.activeMessageMenu = menu;
    
    const rect = triggerEl.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    let top = rect.bottom + 5;
    let left = rect.left;
    if (top + menuRect.height > window.innerHeight) top = rect.top - menuRect.height - 5;
    if (left + menuRect.width > window.innerWidth - 10) left = window.innerWidth - menuRect.width - 10;
    
    menu.style.top = top + 'px';
    menu.style.left = Math.max(10, left) + 'px';

    const closeMenu = (e) => {
        if(!menu.contains(e.target)) {
            menu.remove(); state.activeMessageMenu = null; document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
};

export async function toggleReaction(msgId, emoji) {
    if (!state.currentRoom || !msgId) return;

    const path = `messages/${state.currentRoom}/${msgId}/reactions/${emoji}/${state.userId}`;
    
    const wrapper = document.querySelector(`.message-wrapper[data-msg-id="${msgId}"]`);
    const hasReacted = wrapper?.dataset?.[`react_${emoji}`] === "true";

    await update(ref(db), {
        [path]: hasReacted ? null : true
    });
}

// === LÓGICA DE SELEÇÃO DE TEXTO E AUDIO ===
let selectionBtn = null;

// Detecta fim da seleção
document.addEventListener('mouseup', (e) => {
    // Pequeno delay para garantir que a seleção foi processada pelo navegador
    setTimeout(() => handleTextSelection(), 50); 
});

// Remove o botão se clicar fora
document.addEventListener('mousedown', (e) => {
    if (selectionBtn && !selectionBtn.contains(e.target)) {
        selectionBtn.remove();
        selectionBtn = null;
    }
});

function handleTextSelection() {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    // Se já existe botão, remove para atualizar posição ou sumir se não houver texto
    if (selectionBtn) {
        selectionBtn.remove();
        selectionBtn = null;
    }

    if (!text || text.length === 0) return;

    // Verifica se a seleção está dentro de um balão de chat (qualquer parte)
    // selection.anchorNode pode ser um text node, por isso parentElement
    const anchor = selection.anchorNode.nodeType === 3 ? selection.anchorNode.parentElement : selection.anchorNode;
    const bubble = anchor.closest('.chat-bubble');
    
    if (!bubble) return;

    // Cria o botão flutuante
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    selectionBtn = document.createElement('button');
    selectionBtn.className = 'fixed z-[9999] bg-[var(--primary-color)] hover:opacity-90 text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-bold animate-in fade-in zoom-in duration-200 flex items-center gap-2 border border-white/20 select-none';
    selectionBtn.innerHTML = '<i class="fas fa-volume-high"></i> Ouvir Seleção';
    
    // Posiciona acima da seleção, centralizado
    // rect.top é relativo ao viewport
    const top = rect.top - 40; 
    const left = rect.left + (rect.width / 2) - 50; // -50 é metade da largura estimada do botão
    
    selectionBtn.style.top = `${Math.max(10, top)}px`;
    selectionBtn.style.left = `${Math.max(10, left)}px`;

    // Evita que o clique no botão desfaça a seleção imediatamente ou propague
    selectionBtn.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        speakGeneric(text, null, selectionBtn);
    };

    document.body.appendChild(selectionBtn);
}