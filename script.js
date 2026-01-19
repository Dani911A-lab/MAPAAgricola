// ================= CANVAS =================
const canvasDraw = document.getElementById("drawCanvas");
const ctxDraw = canvasDraw.getContext("2d");

const canvasText = document.getElementById("textCanvas");
const ctxText = canvasText.getContext("2d");

const img = document.getElementById("mapa");
const mapWrapper = document.getElementById("mapWrapper");

// ================= MAP SELECTOR =================
const mapSelect = document.getElementById("mapSelect");

// cambio manual desde el selector
mapSelect.addEventListener("change", e => {
  changeMap(e.target.value);
});

// mapa inicial (MARIA)
window.addEventListener("load", () => {
  changeMap(mapSelect.value);
});


// ================= LOCAL STORAGE POR MAPA =================

function getMapKey(mapName){
  return `mapData_${mapName}`;
}

function saveCurrentMap(){
  if(!img.src) return;

  const mapName = img.src.split("/").pop().replace(".png","");

  const data = {
    draw: canvasDraw.toDataURL(),
    texts: texts
  };

  localStorage.setItem(getMapKey(mapName), JSON.stringify(data));
}

function loadMapData(mapName){
  const raw = localStorage.getItem(getMapKey(mapName));
  if(!raw) return;

  const data = JSON.parse(raw);

  // Restaurar dibujos
  if(data.draw){
    const imgDraw = new Image();
    imgDraw.onload = ()=>{
      ctxDraw.clearRect(0,0,canvasDraw.width,canvasDraw.height);
      ctxDraw.drawImage(imgDraw,0,0,canvasDraw.width,canvasDraw.height);
    };
    imgDraw.src = data.draw;
  }

  // Restaurar textos
  texts = Array.isArray(data.texts) ? data.texts : [];
  redrawTextCanvas();
}



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
  const imgRect = img.getBoundingClientRect();
  const wrapRect = mapWrapper.getBoundingClientRect();

  [canvasDraw, canvasText].forEach(c => {
    c.width  = imgRect.width;
    c.height = imgRect.height;
    c.style.width  = imgRect.width + "px";
    c.style.height = imgRect.height + "px";
    c.style.left = (imgRect.left - wrapRect.left) + "px";
    c.style.top  = (imgRect.top  - wrapRect.top ) + "px";
  });
}

window.addEventListener("resize", resizeCanvas);
img.addEventListener("load", resizeCanvas);
resizeCanvas();

// ================= CAMBIO DE MAPA =================
function changeMap(mapName){

  // 💾 GUARDAR MAPA ACTUAL
  saveCurrentMap();

  // 🔒 Bloquear interacción mientras carga
  tool = null;
  isDrawingToolActive = false;

  // Limpiar canvas y estado
  ctxDraw.clearRect(0,0,canvasDraw.width,canvasDraw.height);
  ctxText.clearRect(0,0,canvasText.width,canvasText.height);

  texts = [];
  activeText = null;
  drawing = false;

  // Reset zoom y pan
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  applyTransform();

  // ⚠️ CLAVE: esperar a que la imagen NUEVA cargue
  img.onload = () => {
    resizeCanvas();        // recalcula tamaño y posición
    redrawTextCanvas();    // limpia canvas texto
    loadMapData(mapName);  // ♻️ RESTAURA DATOS DEL MAPA
  };

  // Cambiar imagen
  img.src = `img/${mapName}.png`;
}



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

penBtn.addEventListener("click", ()=> toggleTool("pen", penBtn));
markerBtn.addEventListener("click", ()=> toggleTool("marker", markerBtn));
eraserBtn.addEventListener("click", ()=> toggleTool("eraser", eraserBtn));

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
  const x = (p.clientX - rect.left) * (canvasDraw.width / rect.width);
  const y = (p.clientY - rect.top)  * (canvasDraw.height / rect.height);
  return { x, y };
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

  if(tool === "eraser" && !drawing){
    drawEraserPreview(p);
  }

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
          color: "#000"
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
    ctxDraw.lineWidth = 1.5;
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
  redrawTextCanvas();
}

// ================= DIBUJAR TEXTO =================
function drawText(t){
  ctxText.save();
  ctxText.font = `${t.size}px Arial`;
  ctxText.fillStyle = t.color;
  ctxText.textBaseline = "top";
  ctxText.fillText(t.text, t.x, t.y);
  ctxText.restore();
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

function drawEraserPreview(p){
  ctxText.clearRect(0,0,canvasText.width,canvasText.height);
  redrawTextCanvas();
  const s = Number(sizeInput.value);
  ctxText.save();
  ctxText.beginPath();
  ctxText.arc(p.x, p.y, s/2, 0, Math.PI*2);
  ctxText.strokeStyle = "rgba(30,136,229,0.8)";
  ctxText.lineWidth = 1;
  ctxText.setLineDash([4,4]);
  ctxText.stroke();
  ctxText.restore();
}

// ================= DESCARGAR PDF =================
const downloadBtn = document.getElementById("downloadBtn");

downloadBtn.addEventListener("click", exportPDF);

function exportPDF(){
  const exportCanvas = document.createElement("canvas");
  const ctx = exportCanvas.getContext("2d");

  exportCanvas.width = img.naturalWidth;
  exportCanvas.height = img.naturalHeight;

  ctx.drawImage(img,0,0,exportCanvas.width,exportCanvas.height);
  ctx.drawImage(canvasDraw,0,0,canvasDraw.width,canvasDraw.height,0,0,exportCanvas.width,exportCanvas.height);
  ctx.drawImage(canvasText,0,0,canvasText.width,canvasText.height,0,0,exportCanvas.width,exportCanvas.height);

  const imgData = exportCanvas.toDataURL("image/png");

  const pdf = new jspdf.jsPDF({
    orientation: exportCanvas.width > exportCanvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [exportCanvas.width, exportCanvas.height]
  });

  pdf.addImage(imgData,"PNG",0,0,exportCanvas.width,exportCanvas.height);
  pdf.save("mapa_hacienda.pdf");
}


