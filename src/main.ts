import "./style.css";
import Phaser from "phaser";
import { maybeLoadDebugConsole } from "./debug";
import { createGameConfig } from "./game/config";
import { setupPwa } from "./pwa";

maybeLoadDebugConsole();

// iOS Safari ignores user-scalable=no for pinch gestures, so block them here.
document.addEventListener("gesturestart", (event) => event.preventDefault());

new Phaser.Game(createGameConfig("game"));
setupPwa();
