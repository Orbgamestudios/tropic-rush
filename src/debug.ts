const FLAG = "debug-console";

/**
 * On-screen dev console for debugging on an iPhone without a Mac.
 * Open the game with `?debug` once to turn it on (it stays on, even in the installed app);
 * `?debug=0` turns it off again.
 */
export async function maybeLoadDebugConsole(): Promise<void> {
  const param = new URLSearchParams(location.search).get("debug");
  try {
    if (param === "0") localStorage.removeItem(FLAG);
    else if (param !== null) localStorage.setItem(FLAG, "1");
    if (localStorage.getItem(FLAG) !== "1") return;
  } catch {
    if (param === null || param === "0") return;
  }

  const { default: eruda } = await import("eruda");
  eruda.init();
}
