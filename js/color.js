const usedHues = []; // chave: IP, valor: cor HSL (string)

function generateUserColor(bgColor, usedHues = [], desiredContrast = 5) {
  function getRGB(color) {
    const temp = document.createElement("div");
    temp.style.color = color;
    document.body.appendChild(temp);
    const rgb = getComputedStyle(temp).color.match(/\d+/g).map(Number);
    document.body.removeChild(temp);
    return rgb;
  }

  function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  function getContrastRatio(fg, bg) {
    const [r1, g1, b1] = getRGB(fg);
    const [r2, g2, b2] = getRGB(bg);
    const L1 = getLuminance(r1, g1, b1);
    const L2 = getLuminance(r2, g2, b2);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  }

  if (!bgColor.startsWith("rgb")) {
    const temp = document.createElement("div");
    temp.style.backgroundColor = bgColor;
    document.body.appendChild(temp);
    bgColor = getComputedStyle(temp).backgroundColor;
    document.body.removeChild(temp);
  }

  const [r, g, b] = getRGB(bgColor);
  const bgLuminance = getLuminance(r, g, b);
  const isBgDark = bgLuminance < 0.5;

  const lightness = isBgDark
    ? 70 + Math.random() * 15 // claro sobre escuro
    : 25 + Math.random() * 15; // escuro sobre claro

  let maxTries = 20;
  while (maxTries-- > 0) {
    let hue = Math.floor(Math.random() * 360);
    const isUsed = usedHues.some(h => Math.abs(h - hue) < 20 || Math.abs(h - hue) > 340);
    if (isUsed) continue;

    const color = `hsl(${hue}, 90%, ${Math.round(lightness)}%)`;
    const contrast = getContrastRatio(color, bgColor);

    if (contrast >= desiredContrast) {
      usedHues.push(hue);
      return { color, hue };
    }
  }

  return { color: "#555", hue: null };
}

// Agora atribui cor pelo IP e mantém a cor persistente para o mesmo IP
function atribuirCorAoUsuario(ip, bgColor = "var(--background-color)") {
  if (userColors[ip]) {
    return userColors[ip];
  }
  const { color, hue } = generateUserColor(bgColor, usedHues);
  userColors[ip] = color;
  return color;
}
