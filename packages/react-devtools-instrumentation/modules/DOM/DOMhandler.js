//===================
// Import
//===================
import { eventBus, events } from "../../utils/eventBus.js";
import { filter } from 'rxjs/operators';
import { showDownloadBtn, logs } from "../../utils/utils.js";




//===================
// Functions
//===================
export class DOMhandler {
  constructor() {
    this.keepOverlay = false;
    this.bacCounter = 0;
  }

  init() {
    this.onDOMReady(() => {
      const els = this.createBackground();
      this.showDownloadBtn();
    });
  }



  onDOMReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb);
    } else {
      cb();
    }
  }



  createBackground() {
    const bg = document.createElement("div");
    const x = document.createElement("div");
    x.style.cssText = `
      position: fixed;
      right: 10px;
      top: 10px;
      width: 40px;
      height: 40px;
      cursor: pointer;
      display: grid;
      place-content: center;
      z-index: 999999;
      font-size: 26px;
      color:white;
    `;
    bg.style.cssText = `
      width:100vw;
      height:100vh;
      background-color:rgba(0,0,0,0.85);
      z-index:999998;
      position:fixed;
      top:0;
      left:0;
      display:none;
    `;

    x.textContent = "x";
    x.addEventListener("click", () => {
      this.keepOverlay = false;
      bg.style.display = "none";
    });

    bg.appendChild(x);
    document.body.appendChild(bg);

    const wrapper = document.createElement("div");
    wrapper.style.cssText = `
      display:flex;
      align-items:center;
      justify-content:center;
      height: 100vh;
      flex-direction: column;
    `;

    bg.appendChild(wrapper);

    const h1 = document.createElement("h1");
    h1.style.color = "white";
    h1.textContent = "Analysis in progress...";

    const h2 = document.createElement("h2");
    h2.style.color = "white";

    const p = document.createElement("p");
    p.style.color = "white";

    wrapper.appendChild(h1);
    wrapper.appendChild(h2);
    wrapper.appendChild(p);

    return { h1, h2, p, bg };
  }



  downloadLogs() {
    const blob = new Blob([logs], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }



  showDownloadBtn() {
    const btn = document.createElement("button");
    btn.innerText = "Download logs";
    btn.style.position = "fixed";
    btn.style.bottom = "10px";
    btn.style.left = "10px";
    btn.style.zIndex = "999999";
    btn.onclick = () => this.downloadLogs();
    document.body.appendChild(btn);
  }
}

