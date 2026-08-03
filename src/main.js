// main.js — el punto de entrada del juego. Orquesta 3 pantallas, en orden:
//   1. Login (auth-container): entrar o crear cuenta con Supabase Auth.
//   2. Creación de DT (manager-form-container): solo si el usuario todavía
//      no tiene un manager creado.
//   3. Apertura de sobres (app, con Phaser): arma y muestra el plantel de
//      25 cartas apenas se crea el DT.
import './style.css';
import Phaser from 'phaser';
import { signIn, signUp, signInAnonymously, getCurrentUser, traducirErrorAuth } from './auth.js';
import { getManagerForUser, createManager } from './managers.js';
import { openInitialPacks } from './packOpening/openPacks.js';
import { getManagerCards } from './lineups.js';
import { countries } from './data/countries.js';
import { leagues } from './data/leagues.js';
import { CustomSelect } from './ui/CustomSelect.js';
import { getCountryFlagUrl, getLeagueLogoUrl, getClubBadgeUrl } from './utils/badgeResolver.js';
import { PackOpeningScene } from './scenes/PackOpeningScene.js';
import { LineupScene } from './scenes/LineupScene.js';
import { CollectionScene } from './scenes/CollectionScene.js';
import { SeasonScene } from './scenes/SeasonScene.js';
import { CareerSummaryScene } from './scenes/CareerSummaryScene.js';
import { CareerTimelineScene } from './scenes/CareerTimelineScene.js';
import { initDevPanel } from './dev/DevPanel.js';
import { setDevGame, setDevManagerId } from './dev/devContext.js';

const authContainer = document.getElementById('auth-container');
const managerFormContainer = document.getElementById('manager-form-container');
const appContainer = document.getElementById('app');

const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const btnLogin = document.getElementById('btn-login');
const btnSignup = document.getElementById('btn-signup');
const btnGuest = document.getElementById('btn-guest');
const btnTogglePassword = document.getElementById('btn-toggle-password');

const managerName = document.getElementById('manager-name');
const managerError = document.getElementById('manager-error');
const btnCreateManager = document.getElementById('btn-create-manager');

// Dropdown de club: sus opciones dependen de la liga elegida (ver más
// abajo), así que arranca vacío y deshabilitado.
const managerClub = new CustomSelect(document.getElementById('manager-club'), {
  placeholder: 'Elegí el club',
  emptyMessage: 'Esta liga no tiene clubes cargados',
  imgShape: 'badge',
});

// Dropdown de liga: sus opciones dependen del país elegido (ver el
// onChange de managerCountry). Al cambiar de liga, reconstruimos el
// dropdown de club con los clubes de esa liga (buscados en leagues.js).
const managerLeague = new CustomSelect(document.getElementById('manager-league'), {
  placeholder: 'Elegí la liga',
  emptyMessage: 'Este país no tiene ligas disponibles',
  imgShape: 'badge',
  onChange: (leagueName) => {
    const ligaElegida = leagues.find((l) => l.league === leagueName);
    managerClub.setItems(
      (ligaElegida?.clubs ?? []).map((club) => ({
        value: club,
        label: club,
        resolveImg: () => getClubBadgeUrl(club),
      })),
    );
  },
});

// Dropdown de país: se llena de entrada con las ~195 opciones de
// countries.js, mostrando bandera (FlagCDN) + nombre en cada ítem. Al
// elegir un país, filtramos las ligas de leagues.js por su campo `country`
// y repoblamos el dropdown de liga (que a su vez vacía el de club).
const managerCountry = new CustomSelect(document.getElementById('manager-country'), {
  placeholder: 'Elegí tu país',
  imgShape: 'flag',
  onChange: (countryName) => {
    const ligasDelPais = leagues.filter((l) => l.country === countryName);
    managerLeague.setItems(
      ligasDelPais.map((l) => ({
        value: l.league,
        label: l.league,
        resolveImg: () => getLeagueLogoUrl(l.league),
      })),
    );
  },
});
managerCountry.setItems(
  countries.map((pais) => ({
    value: pais.name,
    label: pais.name,
    resolveImg: () => getCountryFlagUrl(pais.code),
  })),
);

function mostrarSoloAuth() {
  authContainer.style.display = 'flex';
  managerFormContainer.style.display = 'none';
  appContainer.style.display = 'none';
}

function mostrarSoloFormularioManager() {
  authContainer.style.display = 'none';
  managerFormContainer.style.display = 'flex';
  appContainer.style.display = 'none';
}

// Crea el juego Phaser (vacío de escenas activas) y registra las 3 escenas
// que puede necesitar: PackOpeningScene (solo la primera vez, al crear el
// DT), y LineupScene/CollectionScene (siempre). Las registramos con
// game.scene.add sin arrancarlas para poder elegir con cuál empezar según
// el caso (ver mostrarAperturaDeSobres y mostrarArmadoDe11 más abajo).
async function crearJuego() {
  authContainer.style.display = 'none';
  managerFormContainer.style.display = 'none';
  appContainer.style.display = 'flex';
  appContainer.textContent = ''; // por si había quedado texto de una pantalla anterior

  // Phaser dibuja el texto como imagen dentro del canvas en el momento
  // exacto en que se crea el objeto Text: si el juego arranca antes de que
  // la fuente termine de descargarse, ese texto queda dibujado para siempre
  // con la fuente de respaldo (fallback), aunque la fuente correcta cargue
  // un segundo después. Esperar document.fonts.ready evita ese problema.
  await document.fonts.ready;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#1a1a2e',
    parent: 'app',
  });

  game.scene.add('PackOpeningScene', PackOpeningScene);
  game.scene.add('LineupScene', LineupScene);
  game.scene.add('CollectionScene', CollectionScene);
  game.scene.add('SeasonScene', SeasonScene);
  game.scene.add('CareerSummaryScene', CareerSummaryScene);
  game.scene.add('CareerTimelineScene', CareerTimelineScene);

  setDevGame(game); // el panel de dev necesita esta referencia para poder cambiar de escena
  return game;
}

// Arranca Phaser con los 5 sobres ya armados (solo se llama una vez, justo
// después de crear el DT).
async function mostrarAperturaDeSobres(packs, managerId) {
  const game = await crearJuego();

  // onFinish: se lo pasamos a PackOpeningScene para que, cuando el jugador
  // toque "Armar mi 11" en el resumen final, busquemos sus 25 cartas recién
  // guardadas y pasemos a LineupScene con ellas.
  game.scene.start('PackOpeningScene', {
    packs,
    onFinish: async () => {
      try {
        const cards = await getManagerCards(managerId);
        // game.scene.start(key), a diferencia de this.scene.start(key) desde
        // adentro de una escena, NO para la escena que lo llama: sin este
        // stop explícito, PackOpeningScene seguía activa (y dibujándose)
        // por debajo de LineupScene.
        game.scene.stop('PackOpeningScene');
        game.scene.start('LineupScene', { managerId, cards });
      } catch (error) {
        console.error('No se pudieron cargar las cartas del manager:', error);
      }
    },
  });
}

// Para un manager que YA tenía sus 25 cartas guardadas de antes (por eso no
// pasa por PackOpeningScene, que abriría los sobres de nuevo y duplicaría
// el plantel): va directo a LineupScene, que se encarga de pedir esas
// cartas reales con getManagerCards.
async function mostrarArmadoDe11(managerId) {
  const game = await crearJuego();
  try {
    const cards = await getManagerCards(managerId);
    game.scene.start('LineupScene', { managerId, cards });
  } catch (error) {
    console.error('No se pudieron cargar las cartas del manager:', error);
    appContainer.textContent = 'No se pudieron cargar tus cartas: ' + error.message;
  }
}

// Se llama después de loguearse (o al cargar la página si ya había sesión
// guardada). Decide si mostrar el formulario de DT o, si ya tiene uno, avisar.
async function despuesDeLogin() {
  const usuario = await getCurrentUser();
  if (!usuario) {
    mostrarSoloAuth();
    return;
  }

  const managerExistente = await getManagerForUser(usuario.id);
  if (managerExistente) {
    setDevManagerId(managerExistente.id); // el panel de dev necesita saber quién es el manager actual
    // Los sobres se abren una única vez, al crear el DT. Si ya tiene uno,
    // no hay que volver a mostrarle esa pantalla: vamos directo a armar el 11.
    await mostrarArmadoDe11(managerExistente.id);
    return;
  }

  mostrarSoloFormularioManager();
}

btnTogglePassword.addEventListener('click', () => {
  const oculta = authPassword.type === 'password';
  authPassword.type = oculta ? 'text' : 'password';
  btnTogglePassword.classList.toggle('activo', oculta);
  const titulo = oculta ? 'Ocultar contraseña' : 'Mostrar contraseña';
  btnTogglePassword.title = titulo;
  btnTogglePassword.setAttribute('aria-label', titulo);
});

btnLogin.addEventListener('click', async () => {
  authError.style.color = '';
  authError.textContent = '';
  btnLogin.disabled = true;

  const { error } = await signIn(authEmail.value, authPassword.value);
  btnLogin.disabled = false;

  if (error) {
    authError.textContent = traducirErrorAuth(error);
    return;
  }
  await despuesDeLogin();
});

btnSignup.addEventListener('click', async () => {
  authError.style.color = '';
  authError.textContent = '';
  btnSignup.disabled = true;

  const { error } = await signUp(authEmail.value, authPassword.value);
  btnSignup.disabled = false;

  if (error) {
    authError.textContent = traducirErrorAuth(error);
    return;
  }
  authError.style.color = 'lightgreen';
  authError.textContent = 'Cuenta creada. Si Supabase pide confirmar el email, revisalo; si no, ya podés tocar Ingresar.';
});

btnGuest.addEventListener('click', async () => {
  authError.style.color = '';
  authError.textContent = '';
  btnGuest.disabled = true;

  const { error } = await signInAnonymously();
  btnGuest.disabled = false;

  if (error) {
    authError.textContent = traducirErrorAuth(error);
    return;
  }
  await despuesDeLogin();
});

btnCreateManager.addEventListener('click', async () => {
  managerError.textContent = '';

  const nombre = managerName.value.trim();
  const pais = managerCountry.getValue();
  const liga = managerLeague.getValue();
  const club = managerClub.getValue();

  if (!nombre || !pais || !liga || !club) {
    managerError.textContent = 'Completá nombre, país, liga y club.';
    return;
  }

  const usuario = await getCurrentUser();
  if (!usuario) {
    managerError.textContent = 'Se cerró tu sesión, volvé a ingresar.';
    mostrarSoloAuth();
    return;
  }

  btnCreateManager.disabled = true;
  try {
    const manager = await createManager({ userId: usuario.id, name: nombre, country: pais, league: liga, club });
    setDevManagerId(manager.id); // el panel de dev necesita saber quién es el manager actual
    const packs = await openInitialPacks(manager.id);
    mostrarAperturaDeSobres(packs, manager.id);
  } catch (error) {
    console.error(error);
    managerError.textContent = 'No se pudo crear el DT: ' + error.message;
    btnCreateManager.disabled = false;
  }
});

// Panel de dev (🛠️, esquina inferior derecha): initDevPanel() no hace nada
// si import.meta.env.DEV es false (build de producción), así que es seguro
// llamarla siempre acá. Ver src/dev/DevPanel.js.
initDevPanel();

// Al cargar la página: Supabase guarda la sesión en localStorage, así que
// si el usuario ya estaba logueado saltamos el login y vamos directo al
// paso que le corresponda.
getCurrentUser().then((usuario) => {
  if (usuario) {
    despuesDeLogin();
  } else {
    mostrarSoloAuth();
  }
});
