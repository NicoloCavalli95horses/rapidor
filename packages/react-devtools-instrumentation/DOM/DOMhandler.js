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

  init() {
    this.onDOMReady(() => {
      const bg = this.createBackground();
      this.showDownloadBtn();

      eventBus
        .pipe(filter(e => e.type === events.ANALYSIS_IN_PROGRESS))
        .subscribe(e => this.toggleBg(e.payload, bg));
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
    const el = document.createElement("div");
    el.style.cssText = `
      width:100vw;
      height:100vh;
      background-color:rgba(0,0,0,0.85);
      z-index:9999;
      position:fixed;
      top:0;
      left:0;
      display:none;
      pointer-events:none;
      align-items:center;
      justify-content:center;
    `;

    const h1 = document.createElement("h1");
    h1.style.color = "white";
    h1.textContent = "Analysis in progress...";

    el.appendChild(h1);
    document.body.appendChild(el);
    return el;
  }



  toggleBg(payload, el) {
    el.style.display = payload ? "flex" : "none";
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

