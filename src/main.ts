import "./style.css";
import { maybeLoadDebugConsole } from "./debug";
import { Game } from "./game/Game";
import { setupPwa } from "./pwa";

maybeLoadDebugConsole();

// iOS Safari ignores user-scalable=no for pinch gestures, so block them here.
document.addEventListener("gesturestart", (event) => event.preventDefault());

const container = document.getElementById("game");
if (!container) throw new Error("Missing #game container");
new Game(container);
setupPwa();
