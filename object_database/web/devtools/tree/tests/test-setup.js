// Preload file for JSDOM required tests
import { JSDOM } from "jsdom";

const resetDOM = () => {
    const dom = new JSDOM(
        "<!doctype html><html><head></head>/><body></body>/></html>"
    );
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.customElements = dom.window.customElements;
    globalThis.CustomEvent = dom.window.CustomEvent;
    globalThis.KeyboardEvent = dom.window.KeyboardEvent;
};

globalThis.resetDOM = resetDOM;

resetDOM();
