// ============================================================
// EL REINO DE FELINOR - Dark Fantasy Felina
// ============================================================

const canvas = document.getElementById("juego");
const ctx = canvas.getContext("2d");

// --- CONFIGURACIÓN DE CLASES ---
const clases = {
    guerrero: { 
        emoji: "🐱", 
        nombre: "Guerrero", 
        vida: 120, 
        daño: 25, 
        velocidad: 4,
        alcance: 50,
        color: "#ff6b6b"
    },
    arquero: { 
        emoji: "🙀", 
        nombre: "Arquero", 
        vida: 80, 
        daño: 35, 
        velocidad: 6,
        alcance: 150,
        color: "#4ecdc4"
    },
    mago: { 
        emoji: "😼", 
        nombre: "Mago", 
        vida: 70, 
        daño: 45, 
        velocidad: 3,
        alcance: 120,
        color: "#a55eea"
    }
};

// --- SALAS DE LA MAZMORRA ---
const salas = [
    { nombre: "Sala de Guardias", enemigos: ["🐀", "🐀", "🐀"], boss: false, fondo: "#1a1a2e" },
    { nombre: "Pasillo Oscuro", enemigos: ["🐀", "💀", "🐀"], boss: false, fondo: "#16213e" },
    { nombre: "Cripta de las Sombras", enemigos: ["💀", "💀", "🦇"], boss: false, fondo: "#0f0f0f" },
    { nombre: "Cámara del Terror", enemigos: ["🦇", "💀", "👻"], boss: false, fondo: "#1a0a0a" },
    { nombre: "Nido del Dragón", enemigos: ["🐉"], boss: true, fondo: "#2d0a0a" }
];

// --- VARIABLES DE ESTADO ---
let claseSeleccionada = null;
let juegoIniciado = false;
let salaActual = 0;
let enemigosDerrotados = 0;
let xp = 0;
let nivel = 1;

let jugador = {
    x: 300,
    y: 200,
    w: 40,
    h: 40,
    vida: 100,
    vidaMax: 100,
    daño: 20,
    velocidad: 4,
    alcance: 50,
    emoji: "🐱",
    color: "#fff",
    atacando: false,
    direccion: "abajo",
    invencible: false
};

let enemigos = [];
let proyectiles = [];
let efectos = [];

// --- SISTEMA DE COMBATE ---
let ultimoAtaque = 0;
let cooldownAtaque = 400; // ms

// ============================================================
// --- FUNCIONES DE INTERFAZ ---
// ============================================================

function seleccionarClase(clase) {
    claseSeleccionada = clase;
    
    // Remover selección previa
    document.querySelectorAll(".clase-opcion").forEach(el => {
        el.classList.remove("seleccionada");
    });
    
    // Añadir selección actual
    document.getElementById(`btn-${clase}`).classList.add("seleccionada");
    
    // Habilitar botón de jugar
    document.getElementById("btn-jugar").disabled = false;
}

function cambiarPantalla(pantallaObjetivo) {
    const pantallas = ["menu-inicio", "fin-juego", "juego", "marcador"];
    
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

function mostrarNotificacionSala(nombre, descripcion) {
    const notif = document.getElementById("notificacion-sala");
    notif.innerHTML = `<h3>${nombre}</h3><p>${descripcion}</p>`;
    notif.style.display = "block";
    notif.style.opacity = "1";
    
    setTimeout(() => {
        notif.style.opacity = "0";
        setTimeout(() => {
            notif.style.display = "none";
        }, 500);
    }, 2000);
}

function actualizarMarcador() {
    const vidaEl = document.getElementById("vida-valor");
    const salaEl = document.getElementById("sala-valor");
    const enemigosEl = document.getElementById("enemigos-valor");
    const xpEl = document.getElementById("xp-valor");
    
    if (vidaEl) vidaEl.innerText = Math.max(0, Math.floor(jugador.vida));
    if (salaEl) salaEl.innerText = salaActual + 1;
    if (enemigosEl) enemigosEl.innerText = enemigosDerrotados;
    if (xpEl) xpEl.innerText = xp;
}

// ============================================================
// --- INICIO Y FIN DEL JUEGO ---
// ============================================================

function empezarJuego() {
    if (!claseSeleccionada) return;
    
    const config = clases[claseSeleccionada];
    
    jugador.vida = config.vida;
    jugador.vidaMax = config.vida;
    jugador.daño = config.daño;
    jugador.velocidad = config.velocidad;
    jugador.alcance = config.alcance;
    jugador.emoji = config.emoji;
    jugador.color = config.color;
    jugador.x = 300;
    jugador.y = 200;
    
    salaActual = 0;
    enemigosDerrotados = 0;
    xp = 0;
    nivel = 1;
    juegoIniciado = true;
    
    cambiarPantalla("juego");
    cargarSala(salaActual);
    
    gameLoop();
}

function cargarSala(indice) {
    if (indice >= salas.length) {
        victoriaFinal();
        return;
    }
    
    const sala = salas[indice];
    enemigos = [];
    proyectiles = [];
    
    // Crear enemigos
    sala.enemigos.forEach((tipo, i) => {
        let enemigo;
        if (tipo === "🐉") {
            // Boss dragón
            enemigo = {
                x: 300,
                y: 100,
                w: 80,
                h: 80,
                tipo: "boss",
                emoji: "🐉",
                vida: 200,
                vidaMax: 200,
                daño: 30,
                velocidad: 2,
                estado: "idle",
                timerAtaque: 0
            };
        } else if (tipo === "💀") {
            enemigo = {
                x: 100 + (i % 2) * 400,
                y: 80 + Math.random() * 100,
                w: 35,
                h: 35,
                tipo: "esqueleto",
                emoji: "💀",
                vida: 50,
                vidaMax: 50,
                daño: 15,
                velocidad: 1.5,
                estado: "perseguir"
            };
        } else if (tipo === "🦇") {
            enemigo = {
                x: Math.random() * 500 + 50,
                y: 50 + Math.random() * 100,
                w: 30,
                h: 30,
                tipo: "murcielago",
                emoji: "🦇",
                vida: 30,
                vidaMax: 30,
                daño: 10,
                velocidad: 3,
                estado: "volar"
            };
        } else {
            // Rata
            enemigo = {
                x: 100 + (i % 3) * 200,
                y: 100 + Math.random() * 150,
                w: 30,
                h: 30,
                tipo: "rata",
                emoji: "🐀",
                vida: 40,
                vidaMax: 40,
                daño: 12,
                velocidad: 2,
                estado: "perseguir"
            };
        }
        enemigos.push(enemigo);
    });
    
    mostrarNotificacionSala(sala.nombre, sala.boss ? "¡CUIDADO! Un jefe te espera..." : "Derrota a todos los enemigos");
    actualizarMarcador();
}

function terminarJuego(motivo = "derrota") {
    juegoIniciado = false;
    
    const tituloFin = document.getElementById("titulo-fin");
    const salasFinales = document.getElementById("salas-finales");
    const enemigosFinales = document.getElementById("enemigos-finales");
    
    if (motivo === "victoria") {
        tituloFin.innerText = "¡HAS SALVADO FELINOR!";
        tituloFin.style.color = "#ffd700";
    } else {
        tituloFin.innerText = "¡HAS CAÍDO!";
        tituloFin.style.color = "#ff4444";
    }
    
    if (salasFinales) salasFinales.innerText = salaActual;
    if (enemigosFinales) enemigosFinales.innerText = enemigosDerrotados;
    
    cambiarPantalla("fin-juego");
}

function victoriaFinal() {
    terminarJuego("victoria");
}

function reiniciarJuego() {
    empezarJuego();
}

function volverMenu() {
    juegoIniciado = false;
    cambiarPantalla("menu-inicio");
    document.querySelectorAll(".clase-opcion").forEach(el => {
        el.classList.remove("seleccionada");
    });
    document.getElementById("btn-jugar").disabled = true;
    claseSeleccionada = null;
}

// ============================================================
// --- CONTROLES ---
// ============================================================

const teclas = {};

window.addEventListener("keydown", (e) => {
    teclas[e.key] = true;
    if (e.key === " " || e.key === "z" || e.key === "x") {
        atacar();
    }
});

window.addEventListener("keyup", (e) => {
    teclas[e.key] = false;
});

// Touch para móviles
let touchX = null, touchY = null;

canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    touchX = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    touchY = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    touchX = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    touchY = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
}, { passive: false });

canvas.addEventListener("touchend", () => {
    touchX = null;
    touchY = null;
});

function moverJugador() {
    let dx = 0, dy = 0;
    
    // Teclado
    if (teclas["ArrowUp"] || teclas["w"]) dy = -jugador.velocidad;
    if (teclas["ArrowDown"] || teclas["s"]) dy = jugador.velocidad;
    if (teclas["ArrowLeft"] || teclas["a"]) dx = -jugador.velocidad;
    if (teclas["ArrowRight"] || teclas["d"]) dx = jugador.velocidad;
    
    // Touch
    if (touchX !== null && touchY !== null) {
        const angle = Math.atan2(touchY - jugador.y, touchX - jugador.x);
        const dist = Math.hypot(touchX - jugador.x, touchY - jugador.y);
        if (dist > 10) {
            dx = Math.cos(angle) * jugador.velocidad;
            dy = Math.sin(angle) * jugador.velocidad;
        }
    }
    
    // Actualizar dirección
    if (dx > 0) jugador.direccion = "derecha";
    if (dx < 0) jugador.direccion = "izquierda";
    if (dy > 0) jugador.direccion = "abajo";
    if (dy < 0) jugador.direccion = "arriba";
    
    // Mover
    jugador.x += dx;
    jugador.y += dy;
    
    // Límites
    jugador.x = Math.max(0, Math.min(canvas.width - jugador.w, jugador.x));
    jugador.y = Math.max(0, Math.min(canvas.height - jugador.h, jugador.y));
}

function atacar() {
    if (!juegoIniciado || jugador.atacando) return;
    
    const ahora = Date.now();
    if (ahora - ultimoAtaque < cooldownAtaque) return;
    
    ultimoAtaque = ahora;
    jugador.atacando = true;
    
    // Crear efecto de ataque
    efectos.push({
        x: jugador.x + jugador.w/2,
        y: jugador.y + jugador.h/2,
        radio: 0,
        maxRadio: jugador.alcance,
        alpha: 1,
        tipo: "ataque"
    });
    
    // Detectar impactos
    enemigos.forEach(enemigo => {
        const dist = Math.hypot(
            (jugador.x + jugador.w/2) - (enemigo.x + enemigo.w/2),
            (jugador.y + jugador.h/2) - (enemigo.y + enemigo.h/2)
        );
        
        if (dist <= jugador.alcance) {
            enemigo.vida -= jugador.daño;
            efectos.push({
                x: enemigo.x + enemigo.w/2,
                y: enemigo.y + enemigo.h/2,
                texto: `-${jugador.daño}`,
                alpha: 1,
                tipo: "daño"
            });
            
            if (enemigo.vida <= 0) {
                enemigoDerrotado(enemigo);
            }
        }
    });
    
    setTimeout(() => {
        jugador.atacando = false;
    }, 200);
}

function enemigoDerrotado(enemigo) {
    enemigos = enemigos.filter(e => e !== enemigo);
    enemigosDerrotados++;
    xp += enemigo.tipo === "boss" ? 50 : 10;
    
    // Efecto de muerte
    efectos.push({
        x: enemigo.x + enemigo.w/2,
        y: enemigo.y + enemigo.h/2,
        particulas: [],
        tipo: "explosion"
    });
    
    for (let i = 0; i < 8; i++) {
        efectos[efectos.length - 1].particulas.push({
            x: 0,
            y: 0,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            vida: 20
        });
    }
    
    actualizarMarcador();
    
    // Verificar si sala completada
    if (enemigos.length === 0) {
        setTimeout(() => {
            salaActual++;
            cargarSala(salaActual);
        }, 1000);
    }
}

// ============================================================
// --- IA DE ENEMIGOS ---
// ============================================================

function actualizarEnemigos() {
    enemigos.forEach(enemigo => {
        const dist = Math.hypot(jugador.x - enemigo.x, jugador.y - enemigo.y);
        
        if (enemigo.tipo === "boss") {
            // IA del dragón
            enemigo.timerAtaque++;
            if (dist > 150) {
                // Acercarse
                const angle = Math.atan2(jugador.y - enemigo.y, jugador.x - enemigo.x);
                enemigo.x += Math.cos(angle) * enemigo.velocidad;
                enemigo.y += Math.sin(angle) * enemigo.velocidad;
            }
            if (enemigo.timerAtaque > 100 && dist < 200) {
                // Atacar
                enemigo.timerAtaque = 0;
                jugador.vida -= enemigo.daño;
                efectos.push({
                    x: jugador.x + jugador.w/2,
                    y: jugador.y + jugador.h/2,
                    texto: `-${enemigo.daño}`,
                    alpha: 1,
                    tipo: "daño"
                });
                actualizarMarcador();
                
                if (jugador.vida <= 0) {
                    terminarJuego();
                }
            }
        } else if (enemigo.tipo === "murcielago") {
            // Volar en patrón
            enemigo.x += Math.sin(Date.now() / 200) * 2;
            enemigo.y += Math.cos(Date.now() / 300) * 2;
            
            if (dist < 100) {
                enemigo.x += (jugador.x - enemigo.x) * 0.02;
                enemigo.y += (jugador.y - enemigo.y) * 0.02;
            }
        } else {
            // Perseguir al jugador
            if (dist < 300) {
                const angle = Math.atan2(jugador.y - enemigo.y, jugador.x - enemigo.x);
                enemigo.x += Math.cos(angle) * enemigo.velocidad;
                enemigo.y += Math.sin(angle) * enemigo.velocidad;
            }
            
            // Dañar al jugador si está cerca
            if (dist < 40) {
                if (!jugador.invencible) {
                    jugador.vida -= enemigo.daño * 0.05;
                    actualizarMarcador();
                    
                    if (jugador.vida <= 0) {
                        terminarJuego();
                    }
                }
            }
        }
        
        // Límites
        enemigo.x = Math.max(0, Math.min(canvas.width - enemigo.w, enemigo.x));
        enemigo.y = Math.max(0, Math.min(canvas.height - enemigo.h, enemigo.y));
    });
}

// ============================================================
// --- EFECTOS VISUALES ---
// ============================================================

function actualizarEfectos() {
    efectos.forEach((efecto, index) => {
        if (efecto.tipo === "ataque") {
            efecto.radio += 10;
            efecto.alpha -= 0.1;
            if (efecto.alpha <= 0) efectos.splice(index, 1);
        } else if (efecto.tipo === "daño") {
            efecto.y -= 2;
            efecto.alpha -= 0.05;
            if (efecto.alpha <= 0) efectos.splice(index, 1);
        } else if (efecto.tipo === "explosion") {
            efecto.particulas.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                p.vida--;
            });
            efecto.particulas = efecto.particulas.filter(p => p.vida > 0);
            if (efecto.particulas.length === 0) efectos.splice(index, 1);
        }
    });
}

// ============================================================
// --- DIBUJADO ---
// ============================================================

function dibujar() {
    // Fondo de la sala
    const sala = salas[salaActual] || salas[0];
    ctx.fillStyle = sala.fondo;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Dibujar rejilla decorativa
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }
    
    // Dibujar efectos
    efectos.forEach(efecto => {
        if (efecto.tipo === "ataque") {
            ctx.beginPath();
            ctx.arc(efecto.x, efecto.y, efecto.radio, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${efecto.alpha})`;
            ctx.fill();
        } else if (efecto.tipo === "daño") {
            ctx.font = "bold 20px 'Press Start 2P'";
            ctx.fillStyle = `rgba(255, 0, 0, ${efecto.alpha})`;
            ctx.fillText(efecto.texto, efecto.x, efecto.y);
        } else if (efecto.tipo === "explosion") {
            efecto.particulas.forEach(p => {
                ctx.fillStyle = `rgba(255, 100, 100, ${p.vida / 20})`;
                ctx.fillRect(efecto.x + p.x, efecto.y + p.y, 4, 4);
            });
        }
    });
    
    // Dibujar enemigos
    enemigos.forEach(enemigo => {
        ctx.font = `${enemigo.w}px Arial`;
        ctx.fillText(enemigo.emoji, enemigo.x, enemigo.y + enemigo.h);
        
        // Barra de vida del enemigo
        const vidaPorcentaje = enemigo.vida / enemigo.vidaMax;
        ctx.fillStyle = "#333";
        ctx.fillRect(enemigo.x, enemigo.y - 10, enemigo.w, 5);
        ctx.fillStyle = vidaPorcentaje > 0.5 ? "#4ecdc4" : "#ff6b6b";
        ctx.fillRect(enemigo.x, enemigo.y - 10, enemigo.w * vidaPorcentaje, 5);
    });
    
    // Dibujar jugador
    ctx.font = `${jugador.w}px Arial`;
    ctx.fillText(jugador.emoji, jugador.x, jugador.y + jugador.h);
    
    // Aura del jugador según clase
    ctx.beginPath();
    ctx.arc(jugador.x + jugador.w/2, jugador.y + jugador.h/2, 25, 0, Math.PI * 2);
    ctx.fillStyle = jugador.color + "33";
    ctx.fill();
    
    // Barra de vida del jugador
    const vidaPorcentajeJugador = jugador.vida / jugador.vidaMax;
    ctx.fillStyle = "#333";
    ctx.fillRect(10, 10, 200, 15);
    ctx.fillStyle = vidaPorcentajeJugador > 0.5 ? "#4ecdc4" : "#ff6b6b";
    ctx.fillRect(10, 10, 200 * vidaPorcentajeJugador, 15);
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(10, 10, 200, 15);
}

// ============================================================
// --- BUCLE PRINCIPAL ---
// ============================================================

function gameLoop() {
    if (!juegoIniciado) return;
    
    moverJugador();
    actualizarEnemigos();
    actualizarEfectos();
    dibujar();
    
    requestAnimationFrame(gameLoop);
}

// Inicialización
actualizarMarcador();
