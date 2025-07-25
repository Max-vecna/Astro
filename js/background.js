// Abrir e fechar o modal
function openColorModal() {
  document.getElementById("colorModal").style.display = "flex";
}

function closeColorModal() {
  document.getElementById("colorModal").style.display = "none";
}
// Aplicar cor ao clicar em uma cor predefinida (caneta)
document.querySelectorAll(".color-choice").forEach(btn => {
  btn.addEventListener("click", () => {
    const color = btn.getAttribute("data-color");
    document.documentElement.style.setProperty('--border-color', color);
    localStorage.setItem("borderColor", color);

    const manualColorInput = document.getElementById("manualColorInput");
    if (manualColorInput) manualColorInput.value = color;
  });
});

// Aplicar cor ao clicar nos botões predefinidos de fundo (papel)
document.querySelectorAll(".bg-choice").forEach(btn => {
  btn.addEventListener("click", () => {
    const color = btn.getAttribute("data-bg");
    document.documentElement.style.setProperty('--background-color', color);
    localStorage.setItem("bgColor", color);

    const bgColorInput = document.getElementById("bgColorInput");
    if (bgColorInput) bgColorInput.value = color;
  });
});

// Aplicar cor manual via input da caneta
const manualColorInput = document.getElementById("manualColorInput");
if (manualColorInput) {
  manualColorInput.addEventListener("input", () => {
    const color = manualColorInput.value;
    document.documentElement.style.setProperty('--border-color', color);
    localStorage.setItem("borderColor", color);
  });
}

// Aplicar cor manual via input de fundo
const bgColorInput = document.getElementById("bgColorInput");
if (bgColorInput) {
  bgColorInput.addEventListener("input", () => {
    const color = bgColorInput.value;
    document.documentElement.style.setProperty('--background-color', color);
    localStorage.setItem("bgColor", color);
  });
}

var savedBg;
// Carregar cores salvas ao abrir o app
window.addEventListener("load", () => {
  const savedColor = localStorage.getItem("borderColor");
  if (savedColor) {
    document.documentElement.style.setProperty('--border-color', savedColor);
    const manualColorInput = document.getElementById("manualColorInput");
    if (manualColorInput) manualColorInput.value = savedColor;
  }

  savedBg = localStorage.getItem("bgColor");
  console.log(savedBg);
  if (savedBg) {
    document.documentElement.style.setProperty('--background-color', savedBg);
    const bgColorInput = document.getElementById("bgColorInput");
    if (bgColorInput) bgColorInput.value = savedBg;
  }
});
