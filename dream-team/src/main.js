import Phaser from "phaser";
import { TestScene } from "./scenes/TestScene.js";
import { signIn, signUp, getCurrentUser } from "./auth.js";

const authContainer = document.getElementById("auth-container");
const gameContainer = document.getElementById("game-container");
const errorEl = document.getElementById("auth-error");

function startGame() {
  authContainer.style.display = "none";
  gameContainer.style.display = "flex";

  new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: "#1a1a2e",
    parent: "game-container",
    scene: [TestScene],
  });
}

document.getElementById("btn-login").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const { error } = await signIn(email, password);
  if (error) {
    errorEl.style.color = "salmon";
    errorEl.textContent = error.message;
    return;
  }
  startGame();
});

document.getElementById("btn-signup").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const { error } = await signUp(email, password);
  if (error) {
    errorEl.style.color = "salmon";
    errorEl.textContent = error.message;
    return;
  }
  errorEl.style.color = "lightgreen";
  errorEl.textContent = "Cuenta creada. Ahora toca Ingresar.";
});

getCurrentUser().then((user) => {
  if (user) startGame();
});
