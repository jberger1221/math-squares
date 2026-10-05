// A three-function screen router. Screens are <section id="screen-NAME"> elements;
// each module exports mount(el, ctx) and optionally unmount().

const registry = new Map();
let current = null;

export function register(name, mod) {
  registry.set(name, mod);
}

export function go(name, ctx = {}) {
  const mod = registry.get(name);
  if (!mod) throw new Error(`unknown screen: ${name}`);

  if (current) {
    registry.get(current)?.unmount?.();
    document.getElementById(`screen-${current}`)?.classList.remove('active');
  }

  const el = document.getElementById(`screen-${name}`);
  el.replaceChildren();
  el.classList.add('active');
  current = name;
  mod.mount(el, ctx);
}

export const currentScreen = () => current;
