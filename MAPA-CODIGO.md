# MAPA DE CODIGO — Dream Team
# Auto-generado. No editar a mano. Regenerar con: .\generar-mapa.ps1
# Cline: leer este archivo PRIMERO antes de cualquier tarea

## ESTRUCTURA DE CARPETAS

- src\assets
- src\core
- src\data
- src\dev
- src\engine
- src\events
- src\net
- src\objects
- src\packOpening
- src\scenes
- src\shared
- src\state
- src\theme
- src\ui
- src\utils
- src\assets\images
- src\engine\__tests__

## ARCHIVOS Y SUS EXPORTS/FUNCIONES PRINCIPALES

### src/careerTimeline.js
  L15: export function buildTimelineRows(seasons, currentSeasonNumber, totalSeasons) {

### src/core/constants.js
  (sin exports detectados)

### src/core/errors.js
  L4: export class AppError extends Error {
  L15: export class DataError extends AppError {}
  L17: export class EngineError extends AppError {}
  L19: export class ContentError extends AppError {}

### src/core/logger.js
  L6: export function log(...args) {
  L10: export function warn(...args) {
  L14: export function error(...args) {

### src/core/ratingTiers.js
  L13: export function getTier(rating) {

### src/data/authRepo.js
  L7: export async function signUp(email, password) {
  L12: export async function signIn(email, password) {
  L21: export async function signInAnonymously() {
  L26: export async function signOut() {
  L54: export function traducirErrorAuth(error) {
  L61: export async function getCurrentUser() {

### src/data/cardsRepo.js
  L18: export async function getManagerCards(managerId) {
  L41: export async function borrarCartasDeManager(managerId) {
  L60: async function fetchCardPool(leagueId = null, nationalityId = null) {
  L73: async function fetchOwnedCardIds(managerId) {
  L82: function verificarPoolAlcanza(pool) {
  L97: async function saveSquad(managerId, cards) {
  L129: function normalizarParaUI(c) {
  L142: export async function openDraftPool(managerId, leagueId = null, slots = 15, opci...
  L163: export async function openClubRealSquad(managerId, clubName, leagueId) {
  L199: export async function saveDraftChoices(managerId, cardIds) {
  L207: export async function openInitialPacks(managerId, leagueId = null, nationalityId...

### src/data/countries.js
  (sin exports detectados)

### src/data/escudoteca.js
  L229: const NORM = (s) =>
  L244: export function escudoDeNombre(nombre) {

### src/data/leagues.js
  L239: export function getLeagueById(leagueId) {
  L243: export function getLeagueByClubName(clubName) {
  L247: export function getClubById(leagueId, clubId) {
  L256: export function getClubByNameAndLeague(clubName, leagueName) {
  L261: export function findClubIdByName(clubName) {

### src/data/lineupsRepo.js
  L16: export function positionCountsForFormation(formationKey) {
  L24: export function countByPosition(cards) {
  L38: export function formationFit(selectedCards, formationKey) {
  L61: export function detectBestFormation(selectedCards) {
  L73: export function formacionSugeridaPorDefensores(cantidadDef) {
  L84: async function resolveSeasonNumber(managerId, seasonNumber) {
  L99: export async function getLineup(managerId, seasonNumber = null) {
  L119: export async function saveLineup(managerId, seasonNumber, formation, slots) {

### src/data/managersRepo.js
  L10: export async function getManagerForUser(userId) {
  L29: export async function createManager({ userId, name, country, league, club, leagu...
  L52: export async function getManagerById(managerId) {
  L63: export async function borrarManager(managerId) {

### src/data/mockCards.js
  L10: function getRarityFromRating(rating) {

### src/data/nombres.js
  (sin exports detectados)

### src/data/posiciones.js
  L37: export function penalidad(posCarta, slot) {

### src/data/seasonsRepo.js
  L20: export async function getManagerParaTemporada(managerId) {
  L37: export function calcularRatingDelOnce(starterCards) {
  L46: export async function ratingDelOnceTitular(managerId, seasonNumber) {
  L70: export async function ensureSeason(managerId, seasonNumber, rating) {
  L116: export async function getOrCreateSeasonRow(
  L154: export async function getEventosActivos() {
  L167: export async function guardarEventoResuelto(seasonId, eventCode, matchday, chose...
  L182: export async function cerrarTemporada(seasonId, resumen, moralFinal, fatigaFinal...
  L208: export async function actualizarMoneyManager(managerId, nuevoMonto) {
  L216: export async function getTemporadasDeManager(managerId) {
  L231: export async function crearSiguienteTemporada(

### src/data/supabaseClient.js
  (sin exports detectados)

### src/dev/devActions.js
  L22: function requireGame() {
  L30: function requireManagerId() {
  L44: function iniciarEscenaUnica(game, key, data) {
  L58: export async function simularAperturaDeSobres() {
  L76: export async function irAPantalla(nombreEscena) {
  L131: export async function vaciarPlantel() {
  L141: export async function resetearCuenta() {

### src/dev/devContext.js
  L9: export function setDevGame(juego) {
  L13: export function getDevGame() {
  L17: export function setDevManagerId(managerId) {
  L21: export function getDevManagerId() {

### src/dev/DevPanel.js
  L122: export function initDevPanel() {

### src/engine/__tests__/carrera.test.js
  (sin exports detectados)

### src/engine/balance.js
  (sin exports detectados)

### src/engine/candidatosEvento.js
  L27: export function figurasRecientes(historial) {
  L40: export function figuraConRotacion(rng, plantel, recientes = [], evitarId = null)...
  L50: function usadoAlgunaVez(historial, id) {
  L54: function usosEnTemporada(historial, id, temporada) {
  L58: function apareceEnVentana(e, historial) {
  L63: function dentroDeCupo(e, historial, temporada) {
  L74: export function candidatosEvento(rng, ctx, historial = []) {
  L114: function figuraParaCandidato(rng, e, ctx, lastFiguraId) {
  L120: export function elegirPorSorteo(rng, candidatos, ctx = {}) {
  L125: function narracionDeRespaldo(candidato, ctx = {}) {
  L140: function interpolar(texto, ctx) {
  L152: export function efectosDeOpcion(rng, paqueteId, opcionId) {
  L163: function sortearRama(rng, ramas, paqueteId, opcionId) {
  L182: export function jugadorAleatorioDelOnce(rng, onceCards) {

### src/engine/carrera.js
  L15: const fSlots = (key) => FORMACIONES_SLOTS[key] || FORMACION;
  L22: const limitesTramo = (() => {
  L34: export function cargarCarrera(managerDB, plantelDB, temporadasDB = []) {
  L90: export function iniciarCarrera({
  L102: function getJugadorPorId(id) {
  L165: export function confirmarOnce(c, once) {
  L179: export function ratingActual(c) {
  L183: export function contexto(c) {
  L199: function figuraDelPlantel(c) {
  L206: function proximoRival(c) {
  L220: function racha(partidos) {
  L228: export function jugarTramo(c) {
  L295: function acumularEstadisticas(c, delTramo) {
  L305: function presionExtraDerrotas(partidos) {
  L309: function driftMoral(moral) {
  L316: const redondear = (v) => Math.round(v * 10) / 10;
  L319: export function candidatosDelTramo(c) {
  L365: export function fijarNarracion(c, narracion) {
  L378: export function resolverEvento(c, opcionId) {
  L438: export function elegirReemplazoLesion(c, reemplazoId) {
  L471: function cerrarTemporada(c) {
  L512: function claveJugador(c) {
  L516: function dedupeYExcluir(cartas, plantel) {
  L528: export function abrirRefuerzo(c, pool = null) {
  L539: export function registrarRefuerzo(c, cartasCrudasDB) {
  L547: export function aplicarRefuerzo(c, idsEntran = [], idsSalen = []) {
  L591: export function calcularOfertasPlantel(c) {
  L608: export function resolverOferta(c, id, vender) {
  L624: export function cartasExtraRefuerzo(c, n, pool = null) {
  L631: function terminarCarrera(c, motivo) {
  L642: function escalarPresionDificil(efectos) {
  L654: export function resumenCarrera(c) {

### src/engine/cartas.js
  L6: export function cargarCartasDB(cartasDB) {
  L21: export function envejecerPlantel(rng, plantel) {
  L56: export function valorDeVenta(carta) {

### src/engine/catalogoEventos.js
  L17: const p = (id, def) => ({
  L961: export function paquete(id) {

### src/engine/eventSlots.js
  L24: function enteroAleatorioEntre(minimo, maximo) {
  L30: function elegirSlotsAlAzar(cantidad) {
  L45: function elegirEventoPonderado(eventos) {
  L63: export function elegirEventosDeTemporada(eventosDisponibles) {

### src/engine/formations.js
  (sin exports detectados)

### src/engine/index.js
  (sin exports detectados)

### src/engine/leagueTable.js
  L39: function generarRondasRoundRobin(totalEquipos) {
  L66: function mapearSlotsARivales(rondas) {
  L79: function crearFilaVacia(equipo) {
  L95: function sumarResultado(fila, golesAFavor, golesEnContra) {
  L130: export function calcularTablaFinal({ rivalesFuerza, resultadosJugador }) {

### src/engine/liga.js
  L17: function normalizarNombreClub(nombre) {
  L29: function candidatosRivales(club) {
  L45: export function crearLiga(rng, club, { temporada = 1, posAnterior = null, ovrDT ...
  L84: function gauss(rng, media, sd) {
  L88: const clampNum = (v, a, b) => Math.max(a, Math.min(b, v));
  L91: export function getEstiloRival(rival) {
  L97: function generarFixture(rng, n) {
  L115: function tablaVacia(equipos) {
  L119: function goles(rng, fuerza, rival, localia, mod = 1) {
  L138: function atribuirGol(rng, jugadores) {
  L153: export function simularTramo(rng, liga, desde, hasta, fuerzaMia, misJugadores = ...
  L213: function anotar(tabla, id, gf, gc) {
  L219: export function posiciones(liga) {
  L225: export function miPosicion(liga) {
  L229: export function fuerzaDeEquipo(ratingOnce, estado, momentum) {

### src/engine/narrador.js
  L10: function pistasDeEfectos(efectos) {
  L35: function traducirEfectosParaIA(opcion) {
  L49: export function construirPrompt(candidatos, ctx) {
  L103: function nombrePropioFiltrado(paquete, texto, ctx) {
  L115: export function validarNarracion(respuesta, candidatos, ctx) {
  L149: function esTexto(v, max) {
  L153: function limpiar(s) {

### src/engine/once.js
  L8: export function ratingEnSlot(carta, slot) {
  L17: export function ratingOnce(once, plantel, formacion = FORMACION) {
  L26: export function onceCompleto(once, formacion = FORMACION) {
  L31: export function slotsVacios(once) {
  L44: export function autoOnce(plantel, { excluir = new Set(), formacion = FORMACION }...
  L77: function asignacionOptima(jugadores, slots) {

### src/engine/rivals.js
  L43: function clamp(valor, minimo, maximo) {
  L47: export function generarRivalesFuerza(ratingBase) {

### src/engine/rng.js
  L4: export function createRng(seed = 1) {

### src/engine/seasonOrchestrator.js
  L84: function traducirEffects(effects = {}) {
  L103: function calcularTramoStats(estadoAntes, estadoDespues, desdeJornada, hastaJorna...
  L132: function avanzar({ estado, rivalesFuerza, rivalesNombres, eventosDisponibles }) ...
  L278: export function simularHastaProximoEvento({ estado, rivalesFuerza, rivalesNombre...
  L294: export function aplicarDecisionYContinuar({ estado, decisionElegida, rivalesFuer...

### src/engine/seasonSimulator.js
  L89: function resolverKReversion(kExplicito) {
  L113: function clamp(valor, minimo, maximo) {
  L127: function generarAzarAcotado() {
  L136: function calcularLambdaDeGoles(diferenciaDeFuerza) {
  L147: function sortearGoles(lambda) {
  L167: export function simularJornada(fuerzaLocal, fuerzaVisitante) {
  L192: function generarRivalesAlrededorDe(ratingPlantel) {
  L213: function actualizarMoral(moralActual, resultado, k) {
  L230: function actualizarFatiga(fatigaActual) {
  L246: function estimarPuntosDeRival(fuerzaRival, ratingPlantel) {
  L261: function calcularPosicionFinal(puntosReales, rivales, ratingPlantel) {
  L277: function encontrarRachaMasLarga(resultados, entraEnLaRacha) {
  L299: export function construirMomentosDestacados(resultados) {
  L381: function esListaDeRivalesValida(rivalesFuerza) {
  L390: function resolverRivales(rivalesFuerza, ratingPlantel) {
  L400: function crearEstadoInicial(estado = {}) {
  L449: export function simularTramo({ desdeJornada, hastaJornada, rivalesFuerza, rivale...
  L549: export function simularTemporadaCompleta({ ratingPlantel, moralInicial, fatigaIn...

### src/engine/sobresLocal.js
  L18: const fotoPrueba = (futId) => `https://cdn.futbin.com/content/fifa26/img/players...
  L22: function edadDeFutId(futId) {
  L42: function pickFromPool(rng, pool, rareza, pos, futIdsUsados) {
  L115: function mapearCartaDB(carta, rng, raritySorteada, pos) {
  L132: function cartaCruda(rng, rareza, pos, futIdsUsados = new Set(), pool = null) {
  L160: function sortearRareza(rng, bonus = 0) {
  L173: function abrirSobre(rng, { cartas, bonus = 0, garantizarPuestos = null, futIdsEx...
  L183: export function sobresIniciales(rng) {
  L194: export function sobreRefuerzo(rng, posicionFinal, futIdsExcluir = [], pool = nul...

### src/engine/state.js
  L8: export function createEstado(overrides = {}) {
  L12: function clamp(v, [min, max]) {
  L21: export function aplicarEfectos(estado, efectos = {}, motivo = 'sin-motivo', log ...
  L45: function redondear(k, v) {
  L50: export function resetRatingDelta(estado) {

### src/events/candidatosEvento.js
  L9: function mezclar(array) {
  L25: export async function obtenerCandidatosEvento({ supabase, jornadaActual, histori...

### src/main.js
  L55: function actualizarResumen() {
  L108: function limpiarNombreLiga(nombreLiga) {
  L115: function resolverIdsSeleccion() {
  L192: function mostrarSoloAuth() {
  L198: function mostrarSoloFormularioManager() {
  L211: async function crearJuego() {
  L254: async function mostrarAperturaDeSobres(packs, managerId) {
  L282: async function mostrarArmadoDe11(managerId) {
  L295: async function despuesDeLogin() {

### src/net/evento.js
  L7: export async function pedirNarracion(candidatos, ctx) {

### src/net/supabaseClient.js
  L18: function initSupabase() {
  L47: export async function fetchAbrirSobre({ managerId, packId, free = false } = {}) ...
  L91: export async function fetchCartasPorLiga(leagueId, { excluir = [] } = {}) {
  L132: function normalizarModoJuego(modo_juego) {
  L136: export async function crearManager({ name, country, league_id, club_id, modo = '...

### src/objects/CardSprite.js
  L26: export function claveFotoCarta(cardId) {
  L40: export function dibujarSiluetaGenerica(scene, x = 0, y = -10, radio = 26) {
  L55: export class CardSprite extends Phaser.GameObjects.Container {

### src/objects/RevealCardSprite.js
  L32: export function claveImagenCarta(cardId) {
  L40: export function claveBadge(url) {
  L44: export class RevealCardSprite extends Phaser.GameObjects.Container {

### src/packOpening/draftSquad.js
  L22: function mezclar(array) {
  L40: export function pickWeightedTier(candidatas = null) {
  L101: function elegirCartaPorBanda(candidatas, bandaPedida) {
  L124: export function draftSquad(pool) {
  L171: export function splitIntoPacks(cards, cardsPerPack = CARTAS_POR_SOBRE) {

### src/scenes/CareerSummaryScene.js
  L24: export class CareerSummaryScene extends Phaser.Scene {

### src/scenes/CareerTimelineScene.js
  L18: export class CareerTimelineScene extends Phaser.Scene {

### src/scenes/CollectionScene.js
  L24: export class CollectionScene extends Phaser.Scene {

### src/scenes/LineupScene.js
  L42: function hexToNumber(hexString) {
  L58: function nombrePosicion(posicion, cantidad) {
  L68: function construirStarters(cartasSeleccionadas, formationKey) {
  L86: export class LineupScene extends Phaser.Scene {

### src/scenes/PackOpeningScene.js
  L12: export class PackOpeningScene extends Phaser.Scene {

### src/scenes/SeasonScene.js
  L70: function esperar(ms) {
  L90: export class SeasonScene extends Phaser.Scene {

### src/shared/cardColors.js
  L30: export function colorDeCarta(card) {

### src/state/careerState.js
  L86: function clamp(valor, minimo, maximo) {
  L103: export function initCareerState({ managerId, seasonId, money, morale, fatigue, p...
  L128: export function setManagerProfile({ name, country, league, club, leagueId = null...
  L154: export function getState() {
  L169: export function applyEffects({ moneyDelta = 0, moraleDelta = 0, fatigueDelta = 0...
  L192: export function syncMoraleFatigaDesdeTramo({ moral, fatiga }) {
  L204: export function resetRatingDeltaTemporada() {
  L228: export function calcularResetParcialTemporada() {
  L253: export function syncStreakFromResultados(resultados) {
  L282: export function getEffectiveRating(baseRating) {
  L291: function momentumPorStreak(streak) {
  L305: function penalizacionPorPresion(pressure) {
  L324: export async function persist(matchday) {

### src/theme/tokens.js
  (sin exports detectados)

### src/ui/CustomSelect.js
  L17: export class CustomSelect {

### src/ui/main.js
  L58: const _dtDraft = (() => { try { return JSON.parse(localStorage.getItem('dt_draft...
  L70: const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&l...
  L101: function generarJugadas(partido, misJugadores) {
  L156: function renderSimModal(partido, idx, total, misJugadores, jugadaActual, jugadas...
  L244: function animarJugadaDinamica(cancha, jugada, fichasMap, ball) {
  L329: function mostrarCelebracionGol(cancha, jugada) {
  L358: function resetFichasPosicion(cancha, ball) {
  L367: async function mostrarSimulacionVisual() {
  L531: const miniDots = (f) => `<div class="form-dots">${f.dots.flatMap((row) => row.ma...
  L553: const banderaImg = (nombre) => {
  L576: const escudoDe = (cl) => {
  L587: const escudoRival = (nombre) => {
  L599: const escudoClub = (nombre) => {
  L609: function signoDelta(k, v) {
  L614: function chip(k, v) {
  L622: function statRow(k, v) {
  L636: function probLabel(prob) {
  L642: function splitBar(resultados) {
  L660: function valorEsperado(opcionCat) {
  L669: function chipEsperado(k, v) {
  L677: function chipsEsperados(opcionCat) {
  L685: function chipsFijos(opcionCat) {
  L698: function renderPack(index, disabled = false, label = '') {
  L716: function chipsEnResultado(efectos) {
  L726: function esResultadoPositivo(efectos) {
  L735: function renderDecisionOption(option) {
  L749: function renderEffects(efectos) {
  L766: function decisionResultChips(opcionCat) {
  L782: function aplicarHoverPreview(opcionCat) {
  L808: function limpiarHoverPreview() {
  L815: function bindHoverPreview() {
  L827: function bindGraveHoverPreview() {
  L838: function resultadoBloque(efectos, prob, isTopProb) {
  L855: const fmtMoney = (v) => 'U$D ' + String(Math.round(v * 1_000_000)).replace(/\B(?...
  L862: function carta(x, { sel = false, accion = '', slot = null, bloqueada = false, mo...
  L890: function marcador() {
  L946: function tablaPosiciones() {
  L979: function tablaGoleadores(estadisticas) {
  L1511: function renderBotonNuevaPartida() {
  L1529: function render() {
  L1550: const _guardarDtDraft = () => {
  L1913: function executeDragSwap(srcType, srcId, srcSlotIdx, dstType, dstId, dstSlotIdx)...
  L1931: function clearDragVisuals() {

### src/utils/badgeGenerator.js
  L16: function hashString(str) {
  L24: function getInitials(clubName) {
  L41: function shieldShape(color) {
  L45: function circleShape(color) {
  L49: function hexagonShape(color) {
  L65: export function generateClubBadge(clubName) {
  L77: export function generateClubBadgeDataURI(clubName) {

### src/utils/badgeResolver.js
  L54: export function getCountryFlagUrl(isoCode) {
  L58: export function getInitialsAvatarUrl(name) {
  L65: async function resolveConCache(cache, nombre, url, extraerBadge) {
  L84: export function getClubBadgeUrl(clubName) {
  L109: export function getLeagueLogoUrl(leagueNameOrId) {

### src/utils/cardImage.js
  L19: export function resolveCardImageUrl(card) {

### src/utils/fitImage.js
  L19: export function fitImagen(imagen, anchoMarco, altoMarco, modo = 'contain') {

### src/utils/flags.js
  L4: export function getFlagClass(isoCode) {

### src/utils/initialsAvatar.js
  L26: export function claveAvatarIniciales(cardId) {
  L32: export function getIniciales(name) {
  L49: function construirSVG(iniciales, banda) {
  L78: export function generateInitialsAvatarDataURI(name, overallRating) {

## KEYWORDS POR FEATURE (para buscar rapido)

### Gestion de estado
  - src/careerTimeline.js (L4)
  - src/main.js (L5)
  - src/data/countries.js (L70)
  - src/data/escudoteca.js (L164)
  - src/data/leagues.js (L168)
  - src/data/seasonsRepo.js (L19)
  - src/dev/DevPanel.js (L95)
  - src/engine/balance.js (L18)
  - src/engine/candidatosEvento.js (L71)
  - src/engine/carrera.js (L1)
  - src/engine/index.js (L4)
  - src/engine/leagueTable.js (L119)
  - src/engine/liga.js (L149)
  - src/engine/rng.js (L7)
  - src/engine/seasonOrchestrator.js (L1)
  - src/engine/seasonSimulator.js (L99)
  - src/engine/sobresLocal.js (L118)
  - src/engine/state.js (L1)
  - src/scenes/CareerSummaryScene.js (L53)
  - src/scenes/CareerTimelineScene.js (L89)
  - src/scenes/LineupScene.js (L514)
  - src/scenes/SeasonScene.js (L15)
  - src/state/careerState.js (L1)
  - src/theme/tokens.js (L16)
  - src/ui/main.js (L25)

### Tabla de posiciones
  - src/careerTimeline.js (L3)
  - src/data/authRepo.js (L18)
  - src/data/cardsRepo.js (L9)
  - src/data/leagues.js (L1)
  - src/data/lineupsRepo.js (L81)
  - src/data/managersRepo.js (L1)
  - src/data/mockCards.js (L3)
  - src/data/seasonsRepo.js (L2)
  - src/dev/devActions.js (L128)
  - src/engine/balance.js (L190)
  - src/engine/carrera.js (L29)
  - src/engine/catalogoEventos.js (L2)
  - src/engine/leagueTable.js (L1)
  - src/engine/liga.js (L15)
  - src/engine/seasonSimulator.js (L106)
  - src/engine/sobresLocal.js (L163)
  - src/net/supabaseClient.js (L79)
  - src/objects/CardSprite.js (L58)
  - src/scenes/CareerSummaryScene.js (L36)
  - src/scenes/LineupScene.js (L4)
  - src/scenes/SeasonScene.js (L34)
  - src/shared/cardColors.js (L26)
  - src/ui/main.js (L20)

### Simulacion de partidos
  - src/core/constants.js (L8)
  - src/data/lineupsRepo.js (L3)
  - src/data/seasonsRepo.js (L13)
  - src/dev/devContext.js (L1)
  - src/engine/balance.js (L35)
  - src/engine/candidatosEvento.js (L98)
  - src/engine/carrera.js (L78)
  - src/engine/catalogoEventos.js (L44)
  - src/engine/eventSlots.js (L3)
  - src/engine/leagueTable.js (L5)
  - src/engine/liga.js (L1)
  - src/engine/narrador.js (L22)
  - src/engine/rivals.js (L3)
  - src/engine/seasonOrchestrator.js (L3)
  - src/engine/seasonSimulator.js (L1)
  - src/scenes/SeasonScene.js (L30)
  - src/state/careerState.js (L3)
  - src/ui/main.js (L97)

### Logica de temporada
  - src/careerTimeline.js (L3)
  - src/main.js (L22)
  - src/core/constants.js (L3)
  - src/data/leagues.js (L105)
  - src/data/lineupsRepo.js (L80)
  - src/data/managersRepo.js (L59)
  - src/data/seasonsRepo.js (L1)
  - src/dev/devActions.js (L7)
  - src/dev/DevPanel.js (L215)
  - src/engine/balance.js (L8)
  - src/engine/candidatosEvento.js (L9)
  - src/engine/carrera.js (L5)
  - src/engine/catalogoEventos.js (L7)
  - src/engine/eventSlots.js (L1)
  - src/engine/leagueTable.js (L1)
  - src/engine/liga.js (L1)
  - src/engine/narrador.js (L85)
  - src/engine/once.js (L15)
  - src/engine/rivals.js (L2)
  - src/engine/seasonOrchestrator.js (L1)
  - src/engine/seasonSimulator.js (L1)
  - src/scenes/CareerSummaryScene.js (L2)
  - src/scenes/CareerTimelineScene.js (L2)
  - src/scenes/CollectionScene.js (L97)
  - src/scenes/LineupScene.js (L16)
  - src/scenes/SeasonScene.js (L1)
  - src/state/careerState.js (L3)
  - src/ui/main.js (L16)

### Stats del plantel
  - src/main.js (L415)
  - src/data/seasonsRepo.js (L3)
  - src/engine/balance.js (L21)
  - src/engine/candidatosEvento.js (L180)
  - src/engine/carrera.js (L5)
  - src/engine/catalogoEventos.js (L37)
  - src/engine/liga.js (L93)
  - src/engine/narrador.js (L8)
  - src/engine/seasonOrchestrator.js (L28)
  - src/engine/seasonSimulator.js (L12)
  - src/engine/state.js (L2)
  - src/engine/__tests__/carrera.test.js (L8)
  - src/scenes/SeasonScene.js (L285)
  - src/state/careerState.js (L3)
  - src/ui/main.js (L71)

### Renderizado UI
  - src/main.js (L1)
  - src/data/cardsRepo.js (L52)
  - src/data/lineupsRepo.js (L3)
  - src/dev/devActions.js (L41)
  - src/dev/DevPanel.js (L3)
  - src/engine/seasonOrchestrator.js (L100)
  - src/objects/CardSprite.js (L71)
  - src/packOpening/draftSquad.js (L4)
  - src/scenes/CareerSummaryScene.js (L1)
  - src/scenes/CareerTimelineScene.js (L25)
  - src/scenes/CollectionScene.js (L4)
  - src/scenes/LineupScene.js (L1)
  - src/scenes/PackOpeningScene.js (L4)
  - src/scenes/SeasonScene.js (L1)
  - src/shared/cardColors.js (L5)
  - src/state/careerState.js (L118)
  - src/theme/tokens.js (L8)
  - src/ui/main.js (L61)

### Pantalla de decisiones / eventos
  - src/main.js (L93)
  - src/data/seasonsRepo.js (L4)
  - src/engine/balance.js (L136)
  - src/engine/candidatosEvento.js (L1)
  - src/engine/carrera.js (L2)
  - src/engine/catalogoEventos.js (L5)
  - src/engine/eventSlots.js (L1)
  - src/engine/index.js (L8)
  - src/engine/leagueTable.js (L125)
  - src/engine/narrador.js (L55)
  - src/engine/seasonOrchestrator.js (L1)
  - src/engine/seasonSimulator.js (L143)
  - src/events/candidatosEvento.js (L1)
  - src/net/evento.js (L12)
  - src/scenes/SeasonScene.js (L4)
  - src/state/careerState.js (L25)
  - src/ui/main.js (L4)

### Sistema de transferencias
  - src/main.js (L79)
  - src/engine/catalogoEventos.js (L680)
  - src/ui/main.js (L89)

