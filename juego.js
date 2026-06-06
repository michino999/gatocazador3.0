const canvas = document.getElementById("juego");
const ctx = canvas.getContext("2d");

const statsPersonajes = {
    "🐱": { nombre: "Gato", vel: 20, alcance: 50 },
    "🐯": { nombre: "Tigre", vel: 25, alcance: 50 },
    "🦁": { nombre: "León", vel: 20, alcance: 80 },
    "🐶": { nombre: "Perro", vel: 22, alcance: 65 }
};

// --- PROTECCIÓN DE DATOS ---
const SALT = "ratEscape_v1";
function guardarMonedasSeguro(valor) {
    let hash = btoa(String(valor) + SALT);
    localStorage.setItem("monedas", valor);
    localStorage.setItem("monedas_check", hash);
    // Actualiza el marcador visual si existe
    const elMonedas = document.getElementById("monedas-valor");
    if (elMonedas) elMonedas.innerText = valor;
}

function leerMonedasSeguro() {
    let valor = Number(localStorage.getItem("monedas")) || 0;
    let hashGuardado = localStorage.getItem("monedas_check");
    let hashEsperado = btoa(String(valor) + SALT);
    if (hashGuardado && hashGuardado !== hashEsperado) {
        valor = 0;
        guardarMonedasSeguro(0);
    }
    return valor;
}

// --- VARIABLES DE CONTROL ---
let tiempo = 60;
let puntos = 0;
let record = Number(localStorage.getItem("record")) || 0;
let juegoIniciado = false;
let nivel = 1;
let velocidadGato = 20;
let dificultad = 1;
let loopId = null; 
let monedas = leerMonedasSeguro(); 
let skinActual = localStorage.getItem("skin") || "🐱";
let skinsCompradas = JSON.parse(localStorage.getItem("skinsCompradas")) || ["🐱"];
let experienciaRaton = Number(localStorage.getItem("experienciaRaton")) || 0;

let skinsDisponibles = [
    { emoji: "🐱", nombre: "Gato", precio: 0 },
    { emoji: "🐯", nombre: "Tigre", precio: 100 },
    { emoji: "🦁", nombre: "León", precio: 500 },
    { emoji: "🐶", nombre: "Perro", precio: 200 }
];

let gato = { x: 300, y: 200, w: 35, h: 35 };
let raton = { x: 100, y: 100, w: 25, h: 25 };

let quesoDorado = { x: 0, y: 0, w: 30, h: 30, activo: false, tiempoEnPantalla: 0 };
let ratonSuper = false;
let tiempoSuper = 0;

// ============================================================
// --- CEREBRO DEL RATÓN: SISTEMA DE IA ---
// ============================================================
const GRID_COLS = 10;
const GRID_ROWS = 8;
let mapaPeligro = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(0));

function actualizarMapaPeligro() {
    let col = Math.floor((gato.x / canvas.width) * GRID_COLS);
    let row = Math.floor((gato.y / canvas.height) * GRID_ROWS);
    col = Math.max(0, Math.min(GRID_COLS - 1, col));
    row = Math.max(0, Math.min(GRID_ROWS - 1, row));
    mapaPeligro[row][col] = Math.min(mapaPeligro[row][col] + 0.8, 10);

    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            mapaPeligro[r][c] = Math.max(0, mapaPeligro[r][c] - 0.01);
        }
    }
}

function peligroEnPunto(px, py) {
    let col = Math.floor((px / canvas.width) * GRID_COLS);
    let row = Math.floor((py / canvas.height) * GRID_ROWS);
    col = Math.max(0, Math.min(GRID_COLS - 1, col));
    row = Math.max(0, Math.min(GRID_ROWS - 1, row));
    return mapaPeligro[row][col];
}

const HISTORIAL_MAX = 8;
let historialGato = [];

function actualizarHistorialGato() {
    historialGato.push({ x: gato.x, y: gato.y });
    if (historialGato.length > HISTORIAL_MAX) {
        historialGato.shift();
    }
}

function predecirPosicionGato(framesFuturos) {
    if (historialGato.length < 3) return { x: gato.x, y: gato.y };
    let totalDx = 0, totalDy = 0;
    let muestras = Math.min(historialGato.length - 1, 5);
    for (let i = historialGato.length - 1; i >= historialGato.length - muestras; i--) {
        totalDx += historialGato[i].x - historialGato[i - 1].x;
        totalDy += historialGato[i].y - historialGato[i - 1].y;
    }
    return {
        x: gato.x + ((totalDx / muestras) * framesFuturos),
        y: gato.y + ((totalDy / muestras) * framesFuturos)
    };
}

let anguloEscapeActual = 0;
let framesSinRecalcular = 0;
const FRAMES_RECALCULO = 12;

function elegirMejorAnguloEscape(dx, dy, vel) {
    framesSinRecalcular++;
    if (framesSinRecalcular < FRAMES_RECALCULO) return anguloEscapeActual;
    framesSinRecalcular = 0;

    let mejorAngulo = Math.atan2(dy, dx) + Math.PI;
    let mejorPuntaje = -Infinity;
    let candidatos = 16;
    let gatoFuturo = predecirPosicionGato(10);

    for (let i = 0; i < candidatos; i++) {
        let angulo = (i / candidatos) * Math.PI * 2;
        let futuroX = Math.max(20, Math.min(canvas.width - 20, raton.x + Math.cos(angulo) * vel * 8));
        let futuroY = Math.max(20, Math.min(canvas.height - 20, raton.y + Math.sin(angulo) * vel * 8));

        let distGato = Math.hypot(futuroX - gatoFuturo.x, futuroY - gatoFuturo.y);
        let puntajeDistancia = distGato / canvas.width;
        let peligro = peligroEnPunto(futuroX, futuroY);
        let puntajePeligro = -(peligro / 10) * 0.6;

        let margen = 50;
        let cercaPared =
            (futuroX < margen ? (margen - futuroX) / margen : 0) +
            (futuroX > canvas.width - margen ? (futuroX - (canvas.width - margen)) / margen : 0) +
            (futuroY < margen ? (margen - futuroY) / margen : 0) +
            (futuroY > canvas.height - margen ? (futuroY - (canvas.height - margen)) / margen : 0);
        let puntajePared = -cercaPared * 0.5;

        let puntajeTotal = puntajeDistancia + puntajePeligro + puntajePared;
        if (puntajeTotal > mejorPuntaje) {
            mejorPuntaje = puntajeTotal;
            mejorAngulo = angulo;
        }
    }
    anguloEscapeActual = mejorAngulo;
    return mejorAngulo;
}

const MARGEN_SEGURIDAD_QUESO = 1.4;
const DISTANCIA_ABORTAR_QUESO = 90;

function evaluarQuesoSeguro() {
    if (!quesoDorado.activo) return false;
    let distRatonQueso = Math.hypot(quesoDorado.x - raton.x, quesoDorado.y - raton.y);
    let distGatoQueso = Math.hypot(quesoDorado.x - gato.x, quesoDorado.y - gato.y);
    let gatoFuturo = predecirPosicionGato(15);
    let distGatoFuturoQueso = Math.hypot(quesoDorado.x - gatoFuturo.x, quesoDorado.y - gatoFuturo.y);

    if (distGatoQueso < DISTANCIA_ABORTAR_QUESO || distGatoFuturoQueso < DISTANCIA_ABORTAR_QUESO) return false;
    return distRatonQueso < distGatoQueso * MARGEN_SEGURIDAD_QUESO;
}

// --- INTERFAZ Y NAVEGACIÓN SEGURA ---
function actualizarNivelVisualIA() {
    let expGuardada = Number(localStorage.getItem("experienciaRaton")) || 0;
    let nivelIA = Math.floor(expGuardada / 5) + 1;
    const elemento = document.getElementById("ia-nivel");
    if (elemento) elemento.innerText = nivelIA;
}

function cambiarPantalla(pantallaObjetivo) {
    const pantallas = ["menu-inicio", "menu-ajustes", "menu-tienda", "fin-juego", "juego", "marcador"];
    
    pantallas.forEach(id => {
        const p = document.getElementById(id);
        if (p) p.style.display = "none";
    });

    if (pantallaObjetivo === "juego") {
        const elJuego = document.getElementById("juego");
        const elMarcador = document.getElementById("marcador");
        if (elJuego) elJuego.style.display = "block";
        if (elMarcador) elMarcador.style.display = "flex";
    } else {
        const p = document.getElementById(pantallaObjetivo);
        if (p) p.style.display = "block";
    }
}

// --- CONTROL DE TIENDA DINÁMICA ---
function actualizarBotonesTienda() {
    const lista = document.getElementById("lista-skins");
    if (!lista) return;

    lista.innerHTML = ""; // Limpia los botones viejos hardcodeados
    
    skinsDisponibles.forEach(skin => {
        const btn = document.createElement("button");
        
        if (skinActual === skin.emoji) {
            btn.innerText = `${skin.nombre} (Equipado)`;
        } else if (skinsCompradas.includes(skin.emoji)) {
            btn.innerText = `Equipar ${skin.nombre}`;
        } else {
            btn.innerText = `${skin.nombre} (${skin.precio} 💰)`;
        }

        btn.onclick = () => comprarOEquipar(skin.emoji, skin.precio);
        lista.appendChild(btn);
    });
}

function comprarOEquipar(emoji, precio) {
    if (skinsCompradas.includes(emoji)) {
        equiparSkin(emoji);
    } else if (monedas >= precio) {
        monedas -= precio;
        skinsCompradas.push(emoji);
        guardarMonedasSeguro(monedas);
        localStorage.setItem("skinsCompradas", JSON.stringify(skinsCompradas));
        alert("¡Compra exitosa!");
        equiparSkin(emoji);
    } else {
        alert("¡No tienes suficientes Gatosolares! Tienes: " + monedas);
    }
    actualizarBotonesTienda();
}

function equiparSkin(emoji) {
    skinActual = emoji;
    localStorage.setItem("skin", skinActual);
    actualizarBotonesTienda();
}

// --- FLUJO DE JUEGO ---
function empezarJuego() {
    juegoIniciado = true;
    tiempo = 60;
    puntos = 0;
    nivel = 1;
    quesoDorado.activo = false;
    ratonSuper = false;
    tiempoSuper = 0;

    gato.x = 300; gato.y = 200;
    raton.x = 100; raton.y = 100;
    raton.targetX = null; raton.targetY = null;

    mapaPeligro = Array.from({ length: GRID_ROWS }, () => new Array(GRID_COLS).fill(0));
    historialGato = [];
    anguloEscapeActual = 0;
    framesSinRecalcular = 0;

    const elPuntos = document.getElementById("puntos-valor");
    const elMonedas = document.getElementById("monedas-valor");
    const elNivel = document.getElementById("nivel-valor");
    const elTiempo = document.getElementById("tiempo-valor");

    if (elPuntos) elPuntos.innerText = puntos;
    if (elMonedas) elMonedas.innerText = monedas;
    if (elNivel) elNivel.innerText = nivel;
    if (elTiempo) elTiempo.innerText = tiempo;

    cambiarPantalla("juego");
    if (loopId !== null) cancelAnimationFrame(loopId);
    loopId = requestAnimationFrame(gameLoop);
}

function terminarJuego() {
    juegoIniciado = false;
    if (puntos > record) {
        record = puntos;
        localStorage.setItem("record", record);
    }
    cambiarPantalla("fin-juego");
    const elFinal = document.getElementById("puntos-finales");
    if (elFinal) elFinal.innerText = puntos;
    actualizarNivelVisualIA();
}

function reiniciarJuego() { empezarJuego(); }
function abrirAjustes() { cambiarPantalla("menu-ajustes"); }
function abrirTienda() { cambiarPantalla("menu-tienda"); actualizarBotonesTienda(); }
function volverMenu() { cambiarPantalla("menu-inicio"); actualizarNivelVisualIA(); }

function cambiarDificultad() {
    dificultad = (dificultad % 3) + 1;
    let nombres = ["Fácil", "Normal", "Difícil"];
    document.getElementById("btn-dificultad").innerText = `Dificultad: ${nombres[dificultad-1]}`;
    velocidadGato = dificultad * 5 + 15;
}

// --- ACTUALIZACIÓN DE IA ---
function actualizarRaton() {
    actualizarMapaPeligro();
    actualizarHistorialGato();

    let dx = gato.x - raton.x;
    let dy = gato.y - raton.y;
    let dist = Math.hypot(dx, dy);

    let expGuardada = Number(localStorage.getItem("experienciaRaton")) || 0;
    let nivelAprendizaje = Math.min(expGuardada, 100);
    let radioVision = 180 + (nivelAprendizaje * 1.5);
    let vel = (3 + (nivel * 0.8) + (nivelAprendizaje * 0.03)) * (ratonSuper ? 1.6 : 1);

    let margenPared = 60;
    let cercaDePared = (raton.x < margenPared || raton.x > canvas.width - margenPared - raton.w || raton.y < margenPared || raton.y > canvas.height - margenPared - raton.h);

    let estadoMental = "EXPLORANDO";
    let gatoPredicho = predecirPosicionGato(8);
    let distEfectiva = Math.min(dist, Math.hypot(gatoPredicho.x - raton.x, gatoPredicho.y - raton.y));

    if (distEfectiva < radioVision) {
        if (distEfectiva < 60 && cercaDePared) estadoMental = "ARRINCONADO";
        else if (distEfectiva < 60) estadoMental = "ALERTA_MÁXIMA";
        else estadoMental = "HUYENDO";
    } else if (quesoDorado.activo && evaluarQuesoSeguro()) {
        estadoMental = "BUSCAR_QUESO";
    }

    switch (estadoMental) {
        case "ARRINCONADO":
            let anguloArrinconado = elegirMejorAnguloEscape(dx, dy, vel);
            raton.x += Math.cos(anguloArrinconado) * (vel * 2.5);
            raton.y += Math.sin(anguloArrinconado) * (vel * 2.5);
            raton.targetX = null;
            break;
        case "ALERTA_MÁXIMA":
            if (Math.random() < 0.35) {
                let anguloFinta = Math.atan2(dy, dx) + (Math.PI / 2);
                raton.x += Math.cos(anguloFinta) * vel * 2;
                raton.y += Math.sin(anguloFinta) * vel * 2;
            } else {
                let anguloAlerta = elegirMejorAnguloEscape(dx, dy, vel);
                raton.x += Math.cos(anguloAlerta) * vel * 1.5;
                raton.y += Math.sin(anguloAlerta) * vel * 1.5;
            }
            raton.targetX = null;
            break;
        case "HUYENDO":
            let anguloHuida = elegirMejorAnguloEscape(dx, dy, vel);
            raton.x += Math.cos(anguloHuida) * vel;
            raton.y += Math.sin(anguloHuida) * vel;
            raton.targetX = null;
            break;
        case "BUSCAR_QUESO":
            let qdx = quesoDorado.x - raton.x;
            let qdy = quesoDorado.y - raton.y;
            if (Math.hypot(quesoDorado.x - gato.x, quesoDorado.y - gato.y) < DISTANCIA_ABORTAR_QUESO) {
                let anguloAbortar = elegirMejorAnguloEscape(dx, dy, vel);
                raton.x += Math.cos(anguloAbortar) * vel * 1.3;
                raton.y += Math.sin(anguloAbortar) * vel * 1.3;
            } else if (Math.hypot(qdx, qdy) < 25) {
                quesoDorado.activo = false;
                ratonSuper = true;
                tiempoSuper = 5;
            } else {
                let anguloQueso = Math.atan2(qdy, qdx);
                raton.x += Math.cos(anguloQueso) * vel;
                raton.y += Math.sin(anguloQueso) * vel;
            }
            raton.targetX = null;
            break;
        case "EXPLORANDO":
            if (raton.targetX === null || raton.targetX === undefined || Math.random() < 0.02) {
                let mejorX = 0, mejorY = 0, menorPeligro = Infinity;
                for (let i = 0; i < 6; i++) {
                    let cx = Math.random() * (canvas.width - 50) + 25;
                    let cy = Math.random() * (canvas.height - 50) + 25;
                    let p = peligroEnPunto(cx, cy);
                    if (p < menorPeligro) { menorPeligro = p; mejorX = cx; mejorY = cy; }
                }
                raton.targetX = mejorX; raton.targetY = mejorY;
            }
            if (raton.targetX !== null && raton.targetX !== undefined) {
                if (Math.hypot(raton.targetX - raton.x, raton.targetY - raton.y) < 8) {
                    raton.targetX = null; raton.targetY = null;
                } else {
                    raton.x += (raton.targetX - raton.x) * 0.05;
                    raton.y += (raton.targetY - raton.y) * 0.05;
                }
            }
            break;
    }
    raton.x = Math.max(0, Math.min(canvas.width - raton.w, raton.x));
    raton.y = Math.max(0, Math.min(canvas.height - raton.h, raton.y));
}

// --- BUCLE CENTRAL ---
function gameLoop() {
    if (!juegoIniciado) return;
    moverGatoConTouch();
    actualizarRaton();
    dibujar();
    loopId = requestAnimationFrame(gameLoop);
}

function dibujar() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (quesoDorado.activo) {
        ctx.font = "30px Arial";
        ctx.fillText("🧀", quesoDorado.x, quesoDorado.y + 25);
    }

    ctx.font = "40px Arial";
    ctx.fillText(skinActual, gato.x, gato.y + 35);
    ctx.fillText("🐭", raton.x, raton.y + 30);

    if (ratonSuper) {
        ctx.font = "25px Arial";
        ctx.fillText("⚡", raton.x + 5, raton.y - 5);
    }
}

// --- TEMPORIZADORES EN SEGUNDOS ---
setInterval(() => {
    if (!juegoIniciado) return;
    tiempo--;
    const elTiempo = document.getElementById("tiempo-valor");
    if (elTiempo) elTiempo.innerText = tiempo;

    if (tiempo === 45) { nivel = 2; const n = document.getElementById("nivel-valor"); if (n) n.innerText = nivel; }
    if (tiempo === 30) { nivel = 3; const n = document.getElementById("nivel-valor"); if (n) n.innerText = nivel; }
    if (tiempo === 15) { nivel = 4; const n = document.getElementById("nivel-valor"); if (n) n.innerText = nivel; }

    if (tiempo % 20 === 0 && tiempo > 0 && !quesoDorado.activo) {
        quesoDorado.activo = true;
        quesoDorado.x = Math.random() * (canvas.width - 40) + 10;
        quesoDorado.y = Math.random() * (canvas.height - 40) + 10;
        quesoDorado.tiempoEnPantalla = 8;
    }

    if (quesoDorado.activo) {
        quesoDorado.tiempoEnPantalla--;
        if (quesoDorado.tiempoEnPantalla <= 0) quesoDorado.activo = false;
    }

    if (ratonSuper) {
        tiempoSuper--;
        if (tiempoSuper <= 0) ratonSuper = false;
    }

    if (tiempo <= 0) terminarJuego();
}, 1000);

// --- TECLADO Y COLISIONES ---
window.addEventListener("keydown", (e) => {
    if (!juegoIniciado) return;
    let stats = statsPersonajes[skinActual] || statsPersonajes["🐱"];

    if (e.key === "ArrowUp") gato.y = Math.max(0, gato.y - stats.vel);
    if (e.key === "ArrowDown") gato.y = Math.min(canvas.height - gato.h, gato.y + stats.vel);
    if (e.key === "ArrowLeft") gato.x = Math.max(0, gato.x - stats.vel);
    if (e.key === "ArrowRight") gato.x = Math.min(canvas.width - gato.w, gato.x + stats.vel);

    procesarColisiones(stats);
});

function procesarColisiones(stats) {
    if (quesoDorado.activo && Math.hypot((gato.x + 17) - (quesoDorado.x + 15), (gato.y + 17) - (quesoDorado.y + 15)) < stats.alcance) {
        quesoDorado.activo = false;
        monedas += 50;
        puntos += 5;
        guardarMonedasSeguro(monedas);
        document.getElementById("puntos-valor").innerText = puntos;
    }

    if (Math.hypot((gato.x + 17) - (raton.x + 12), (gato.y + 17) - (raton.y + 12)) < stats.alcance) {
        if (ratonSuper) return;

        puntos++;
        monedas += (30 * dificultad);
        experienciaRaton++;
        localStorage.setItem("experienciaRaton", experienciaRaton);
        guardarMonedasSeguro(monedas);

        document.getElementById("puntos-valor").innerText = puntos;

        raton.x = Math.random() * (canvas.width - 30);
        raton.y = Math.random() * (canvas.height - 30);
    }
}

// --- SOPORTE MÓVIL (TOUCH) ---
let touchActivo = false, touchX = 0, touchY = 0;

canvas.addEventListener("touchstart", (e) => {
    if (!juegoIniciado) return;
    e.preventDefault(); touchActivo = true;
    const rect = canvas.getBoundingClientRect();
    touchX = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    touchY = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    if (!juegoIniciado) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    touchX = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    touchY = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
}, { passive: false });

canvas.addEventListener("touchend", () => { touchActivo = false; });

function moverGatoConTouch() {
    if (!touchActivo || !juegoIniciado) return;
    let stats = statsPersonajes[skinActual] || statsPersonajes["🐱"];
    let dxTouch = touchX - (gato.x + 17);
    let dyTouch = touchY - (gato.y + 17);
    let distTouch = Math.hypot(dxTouch, dyTouch);

    if (distTouch > 10) {
        let velTouch = Math.min(stats.vel, distTouch);
        gato.x += (dxTouch / distTouch) * velTouch;
        gato.y += (dyTouch / distTouch) * velTouch;
        gato.x = Math.max(0, Math.min(canvas.width - gato.w, gato.x));
        gato.y = Math.max(0, Math.min(canvas.height - gato.h, gato.y));
        procesarColisiones(stats);
    }
}

// Inicialización
actualizarNivelVisualIA();