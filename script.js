// ================= CANVAS =================
const canvasDraw = document.getElementById("drawCanvas");
const ctxDraw = canvasDraw.getContext("2d");

const canvasText = document.getElementById("textCanvas");
const ctxText = canvasText.getContext("2d");

const img = document.getElementById("mapa");
const mapWrapper = document.getElementById("mapWrapper");

// ================= HERRAMIENTAS =================
const textBtn   = document.getElementById("textTool");
const penBtn    = document.getElementById("penTool");
const markerBtn = document.getElementById("markerTool");
const eraserBtn = document.getElementById("eraserTool");

const colorInput = document.getElementById("markerColor");
const sizeInput  = document.getElementById("markerSize");

// ================= ESTADO =================
let tool = null;
let drawing = false;
let addingText = false;
let isDrawingToolActive = false;

// ================= TEXTO =================
let texts = [];
let activeText = null;
let dragOffset = { x: 0, y: 0 };
let resizing = false;
let draggingText = false;
let resizeCorner = null;

// ================= RESIZE CANVAS =================
function resizeCanvas() {
  const rect = img.getBoundingClientRect();
  [canvasDraw, canvasText].forEach(c => {
    c.width = rect.width;
    c.height = rect.height;
    c.style.width = rect.width + "px";
    c.style.height = rect.height + "px";
    c.style.top = "0px";
    c.style.left = "0px";
  });
  redrawTextCanvas();
}

window.addEventListener("resize", resizeCanvas);
img.onload = resizeCanvas;
resizeCanvas();

// ================= TOGGLE TOOLS =================
function toggleTool(selectedTool, btn) {
  if (tool === selectedTool) {
    tool = null;
    isDrawingToolActive = false;
    btn.classList.remove("active");
  } else {
    tool = selectedTool;
    isDrawingToolActive = true;
    [penBtn, markerBtn, eraserBtn].forEach(b => {
      if (b !== btn) b.classList.remove("active");
    });
    btn.classList.add("active");
  }
  activeText = null;
  addingText = false;
}

penBtn.addEventListener("click", () => toggleTool("pen", penBtn));
markerBtn.addEventListener("click", () => toggleTool("marker", markerBtn));
eraserBtn.addEventListener("click", () => toggleTool("eraser", eraserBtn));

textBtn.addEventListener("click", () => {
  tool = "text";
  addingText = true;
  activeText = null;
  isDrawingToolActive = false;
  [penBtn, markerBtn, eraserBtn].forEach(b => b.classList.remove("active"));
});

// ================= POSICIÓN =================
let scale = 1;
let offsetX = 0;
let offsetY = 0;

function getPos(e) {
  const rect = canvasDraw.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  return {
    x: (p.clientX - rect.left) / scale,
    y: (p.clientY - rect.top) / scale
  };
}

// ================= TEXTO =================
function measureTextBox(t) {
  ctxText.font = `${t.size}px Arial`;
  return {
    x: t.x,
    y: t.y,
    w: ctxText.measureText(t.text).width,
    h: t.size
  };
}

function getTextAt(p) {
  for (let i = texts.length - 1; i >= 0; i--) {
    const b = measureTextBox(texts[i]);
    if (
      p.x >= b.x &&
      p.x <= b.x + b.w &&
      p.y >= b.y &&
      p.y <= b.y + b.h
    ) return texts[i];
  }
  return null;
}

// ================= EVENTS =================
[canvasDraw, canvasText].forEach(c => {
  c.addEventListener("mousedown", start);
  c.addEventListener("touchstart", start, { passive: false });
  c.addEventListener("mousemove", move);
  c.addEventListener("touchmove", move, { passive: false });
  c.addEventListener("mouseup", end);
  c.addEventListener("mouseleave", end);
  c.addEventListener("touchend", end);
});

// ================= START =================
function start(e) {
  const p = getPos(e);

  if (tool === "eraser") {
    drawing = true;
    ctxDraw.beginPath();
    ctxDraw.moveTo(p.x, p.y);
    drawEraserPreview(p);
    return;
  }

  if (tool === "text") {
    const txt = prompt("Texto:");
    if (txt) {
      texts.push({
        text: txt,
        x: p.x,
        y: p.y,
        size: Number(sizeInput.value) + 6,
        color: colorInput.value
      });
      redrawTextCanvas();
    }
    addingText = false;
    return;
  }

  if (!isDrawingToolActive) return;

  drawing = true;
  ctxDraw.beginPath();
  ctxDraw.moveTo(p.x, p.y);
}

// ================= MOVE =================
function move(e) {
  const p = getPos(e);

  if (tool === "eraser") {
    drawEraserPreview(p);

    if (!drawing) return;

    ctxDraw.save();
    ctxDraw.globalCompositeOperation = "destination-out";
    ctxDraw.lineCap = "round";
    ctxDraw.lineJoin = "round";
    ctxDraw.lineWidth = Number(sizeInput.value);
    ctxDraw.lineTo(p.x, p.y);
    ctxDraw.stroke();
    ctxDraw.restore();
    return;
  }

  if (!drawing) return;
  e.preventDefault();

  ctxDraw.lineCap = "round";
  ctxDraw.lineJoin = "round";

  if (tool === "pen") {
    ctxDraw.strokeStyle = "#222";
    ctxDraw.lineWidth = 2.5;
    ctxDraw.lineTo(p.x, p.y);
    ctxDraw.stroke();
  }

  if (tool === "marker") {
    const s = Number(sizeInput.value);

    ctxDraw.save();
    ctxDraw.globalAlpha = 0.35;
    ctxDraw.strokeStyle = colorInput.value;
    ctxDraw.lineWidth = s;
    ctxDraw.lineTo(p.x, p.y);
    ctxDraw.stroke();
    ctxDraw.restore();
  }
}

// ================= END =================
function end() {
  drawing = false;
  ctxDraw.globalCompositeOperation = "source-over";
  redrawTextCanvas();
}

// ================= DIBUJAR TEXTO =================
function redrawTextCanvas() {
  ctxText.clearRect(0, 0, canvasText.width, canvasText.height);

  texts.forEach(t => {
    ctxText.font = `${t.size}px Arial`;
    ctxText.fillStyle = t.color;
    ctxText.fillText(t.text, t.x, t.y + t.size);
  });
}

// ================= BORRADOR PREVIEW =================
function drawEraserPreview(p) {
  redrawTextCanvas();

  const s = Number(sizeInput.value);

  ctxText.save();
  ctxText.beginPath();
  ctxText.arc(p.x, p.y, s / 2, 0, Math.PI * 2);
  ctxText.strokeStyle = "rgba(30,136,229,0.9)";
  ctxText.lineWidth = 1;
  ctxText.setLineDash([5, 5]);
  ctxText.stroke();
  ctxText.restore();
}
