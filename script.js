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
let dragOffset = {x:0, y:0};
let resizing = false;
let draggingText = false;
let resizeCorner = null;

// ================= RESIZE CANVAS =================
function resizeCanvas(){
  const rect = img.getBoundingClientRect();
  [canvasDraw, canvasText].forEach(c=>{
    c.width = rect.width;
    c.height = rect.height;
    c.style.width = rect.width + "px";
    c.style.height = rect.height + "px";

    // IMPORTANTE: anclar al wrapper
    c.style.top = "0px";
    c.style.left = "0px";
  });
}

window.addEventListener("resize", resizeCanvas);
img.onload = resizeCanvas;
resizeCanvas();

// ================= TOGGLE HERRAMIENTAS =================
function toggleTool(selectedTool, btn){
  if(tool === selectedTool){
    tool = null;
    isDrawingToolActive = false;
    btn.classList.remove("active");
  } else {
    tool = selectedTool;
    isDrawingToolActive = true;
    [penBtn, markerBtn, eraserBtn].forEach(b=>{
      if(b!==btn) b.classList.remove("active");
    });
    btn.classList.add("active");
  }
  activeText = null;
  addingText = false;
}

// Botones toggle
penBtn.addEventListener("click", ()=> toggleTool("pen", penBtn));
markerBtn.addEventListener("click", ()=> toggleTool("marker", markerBtn));
eraserBtn.addEventListener("click", ()=> toggleTool("eraser", eraserBtn));

// Texto independiente
textBtn.addEventListener("click", ()=>{
  tool = "text";
  addingText = true;
  activeText = null;
  [penBtn, markerBtn, eraserBtn].forEach(b=>b.classList.remove("active"));
  isDrawingToolActive = false;
});

// ================= POSICIÓN =================
let scale = 1;
let offsetX = 0;
let offsetY = 0;

function getPos(e){
  const rect = canvasDraw.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  const x = (p.clientX - rect.left)/scale;
  const y = (p.clientY - rect.top)/scale;
  return {x, y};
}

// ================= TEXTO =================
function measureTextBox(t){
  ctxText.font = `${t.size}px Arial`;
  return { x: t.x, y: t.y, w: ctxText.measureText(t.text).width, h: t.size };
}

function getTextAt(p){
  for(let i=texts.length-1;i>=0;i--){
    const b = measureTextBox(texts[i]);
    if(p.x>=b.x && p.x<=b.x+b.w && p.y>=b.y && p.y<=b.y+b.h) return texts[i];
  }
  return null;
}

function getHandleAt(p, box){
  const s = 8;
  const corners = { tl:{x:box.x,y:box.y}, tr:{x:box.x+box.w,y:box.y}, bl:{x:box.x,y:box.y+box.h}, br:{x:box.x+box.w,y:box.y+box.h} };
  for(const k in corners){
    const c = corners[k];
    if(Math.abs(p.x-c.x)<s && Math.abs(p.y-c.y)<s) return k;
  }
  return null;
}

// ================= EVENTS =================
[canvasDraw, canvasText].forEach(c=>{
  c.addEventListener("mousedown", start);
  c.addEventListener("touchstart", start);
  c.addEventListener("mousemove", move);
  c.addEventListener("touchmove", move);
  c.addEventListener("mouseup", end);
  c.addEventListener("mouseleave", end);
  c.addEventListener("touchend", end);
});

// ================= START =================
function start(e){
  const p = getPos(e);

  if(tool === "text"){
    const hit = getTextAt(p);
    if(hit){
      activeText = hit;
      const box = measureTextBox(hit);
      const h = getHandleAt(p, box);
      if(h){ resizing = true; resizeCorner = h; }
      else{ draggingText = true; dragOffset.x = p.x - hit.x; dragOffset.y = p.y - hit.y; }
      redrawTextCanvas();
      return;
    }
    activeText = null;
    resizing = false;
    draggingText = false;
    redrawTextCanvas();
    if(addingText){
      const txt = prompt("Texto:");
      if(txt){
        texts.push({
          text: txt,
          x: p.x,
          y: p.y,
          size: Number(sizeInput.value)+6,
          color: colorInput.value
        });
        redrawTextCanvas();
      }
      addingText = false;
    }
    return;
  }

  if(!isDrawingToolActive) return;

  drawing = true;
  ctxDraw.beginPath();
  ctxDraw.moveTo(p.x, p.y);
}

// ================= MOVE =================
function move(e){
  const p = getPos(e);

  if(activeText){
    if(resizing && resizeCorner){
      const b = measureTextBox(activeText);
      switch(resizeCorner){
        case "tl": activeText.size = Math.max(10, b.h + (b.y - p.y)); activeText.x = p.x; activeText.y = p.y; break;
        case "tr": activeText.size = Math.max(10, b.h + (b.y - p.y)); activeText.y = p.y; break;
        case "bl": activeText.size = Math.max(10, p.y - b.y); activeText.x = p.x; break;
        case "br": activeText.size = Math.max(10, p.y - b.y); break;
      }
      redrawTextCanvas();
    } else if(draggingText){
      activeText.x = p.x - dragOffset.x;
      activeText.y = p.y - dragOffset.y;
      redrawTextCanvas();
    }
    return;
  }

  if(!drawing) return;
  e.preventDefault();

  ctxDraw.lineCap = "round";
  ctxDraw.lineJoin = "round";

  if(tool === "pen"){
    ctxDraw.globalCompositeOperation = "source-over";
    ctxDraw.strokeStyle = "#222";
    ctxDraw.lineWidth = 2.5;
    ctxDraw.lineTo(p.x,p.y);
    ctxDraw.stroke();
  }

  if(tool === "marker"){
    const s = Number(sizeInput.value);
    ctxDraw.save();
    ctxDraw.globalCompositeOperation="destination-out";
    ctxDraw.lineWidth=s;
    ctxDraw.lineTo(p.x,p.y);
    ctxDraw.stroke();
    ctxDraw.restore();

    ctxDraw.save();
    ctxDraw.globalCompositeOperation="source-over";
    ctxDraw.globalAlpha=0.40;
    ctxDraw.strokeStyle=colorInput.value;
    ctxDraw.lineWidth=s;
    ctxDraw.lineTo(p.x,p.y);
    ctxDraw.stroke();
    ctxDraw.restore();
  }

  if(tool === "eraser"){
    const s = Number(sizeInput.value);
    for(let i = texts.length-1; i>=0; i--){
      const b = measureTextBox(texts[i]);
      if(p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h){
        texts.splice(i,1);
        redrawTextCanvas();
      }
    }
    ctxDraw.save();
    ctxDraw.globalCompositeOperation="destination-out";
    ctxDraw.lineWidth = s;
    ctxDraw.lineTo(p.x, p.y);
    ctxDraw.stroke();
    ctxDraw.restore();
  }
}

// ================= END =================
function end(){
  drawing = false;
  resizing = false;
  draggingText = false;
  resizeCorner = null;
  ctxDraw.globalCompositeOperation="source-over";
}

// ================= DIBUJAR TEXTO =================
function drawText(t){
  ctxText.fillStyle = t.color;
  ctxText.font = `${t.size}px Arial`;
  ctxText.textBaseline = "top";
  ctxText.fillText(t.text, t.x, t.y);
}

// ================= REDRAW =================
function redrawTextCanvas(){
  ctxText.clearRect(0,0,canvasText.width,canvasText.height);
  texts.forEach(t => drawText(t));
  if(activeText){
    const b = measureTextBox(activeText);
    ctxText.save();
    ctxText.setLineDash([4,4]);
    ctxText.strokeStyle="#1e88e5";
    ctxText.strokeRect(b.x-2,b.y-2,b.w+4,b.h+4);
    ctxText.restore();
    const pts = [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]];
    pts.forEach(p=>{
      ctxText.fillStyle="#1e88e5";
      ctxText.fillRect(p[0]-4,p[1]-4,8,8);
    });
  }
}

// ================= ZOOM + PAN =================
let lastDist = null;
let lastPan = null;

function applyTransform(){
  mapWrapper.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
}

function limitOffsets(){
  const rect = img.getBoundingClientRect();
  const w = rect.width * scale;
  const h = rect.height * scale;
  const cw = mapWrapper.getBoundingClientRect().width;
  const ch = mapWrapper.getBoundingClientRect().height;

  const maxX = Math.max(0, (w - cw)/2);
  const maxY = Math.max(0, (h - ch)/2);

  offsetX = Math.min(maxX, Math.max(-maxX, offsetX));
  offsetY = Math.min(maxY, Math.max(-maxY, offsetY));
}

mapWrapper.addEventListener("touchstart", e=>{
  if(e.touches.length === 2){
    lastDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    tool = null;
    isDrawingToolActive = false;
    [penBtn, markerBtn, eraserBtn].forEach(b=>b.classList.remove("active"));
  } else if(e.touches.length === 1 && scale > 1 && !isDrawingToolActive){
    lastPan = {x: e.touches[0].clientX, y: e.touches[0].clientY};
  }
}, {passive:false});

mapWrapper.addEventListener("touchmove", e=>{
  if(e.touches.length === 2){
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    if(lastDist){
      let factor = dist / lastDist;
      scale *= factor;
      scale = Math.min(Math.max(scale, 1), 4);
      limitOffsets();
      applyTransform();
    }
    lastDist = dist;
  } else if(e.touches.length === 1 && scale > 1 && lastPan && !isDrawingToolActive){
    e.preventDefault();
    const dx = e.touches[0].clientX - lastPan.x;
    const dy = e.touches[0].clientY - lastPan.y;
    offsetX += dx;
    offsetY += dy;
    limitOffsets();
    applyTransform();
    lastPan.x = e.touches[0].clientX;
    lastPan.y = e.touches[0].clientY;
  }
}, {passive:false});

mapWrapper.addEventListener("touchend", e=>{
  if(e.touches.length < 2) lastDist = null;
  if(e.touches.length === 0) lastPan = null;
});
