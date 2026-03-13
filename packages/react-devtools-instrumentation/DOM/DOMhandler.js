//===================
// Import
//===================
import { eventBus, events } from "../eventBus.js";
import { filter } from 'rxjs/operators';
import { showDownloadBtn, logs } from "../utils.js";




//===================
// Functions
//===================
export class DOMhandler {
  constructor() {
    this.keepOverlay = false;
  } 

  init() {
    this.onDOMReady(() => {
      const els = this.createBackground();
      this.showDownloadBtn();

      eventBus.subscribe((e) => {
        if (e.type === events.ANALYSIS_IN_PROGRESS) {
          this.updateProgressBar({ payload: e.payload, els });
        } else if (e.type === events.REPORT) {
          // this.showWarning(els);
        }
      });
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
    bg.style.cssText = `
      width:100vw;
      height:100vh;
      background-color:rgba(0,0,0,0.85);
      z-index:9999;
      position:fixed;
      top:0;
      left:0;
      display:none;
      pointer-events:none;
    `;

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
    h2.style.color = "orange";

    const p = document.createElement("p");
    p.style.color = "white";

    const pr = document.createElement("progress");
    pr.value = 0;
    pr.max = 100;
    pr.style.width = "400px";
    pr.style.height = "50px";

    wrapper.appendChild(h1);
    wrapper.appendChild(p);
    wrapper.appendChild(pr);
    wrapper.appendChild(h2);

    return { bg, h1, h2, p, pr };
  }



  updateProgressBar({ payload, els }) {
    const { bg, p, pr } = els;
    const { max, value, totHTTPevents, totStates } = payload.progress;
    p.textContent = `${value} out of ${max} (HTTP events: ${totHTTPevents}, states: ${totStates})`;
    pr.value = value;
    pr.max = max;
    bg.style.display = (payload.on_progress || this.keepOverlay) ? "block" : "none";
  }



  showWarning(els) {
    const { bg, h2 } = els;
    bg.style.display = "block";
    h2.textContent = "Potential access control issue found ⚠️​";
    this.keepOverlay = true;
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

