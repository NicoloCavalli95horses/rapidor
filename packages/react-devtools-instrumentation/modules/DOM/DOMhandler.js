//===================
// Import
//===================
import { logs, printMetrics } from "../../utils/utils.js";




//===================
// Functions
//===================
export class DOMhandler {
  init() {
    this.onDOMReady(() => {
      this.showDownloadBtn();
      this.showStatsBtn();
    });
  }



  onDOMReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb);
    } else {
      cb();
    }
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



  // Prints the centralized RAPIDOR self-metrics table (states, components, HTTP events, etc.) to the console
  showStatsBtn() {
    const btn = document.createElement("button");
    btn.innerText = "Print stats";
    btn.style.position = "fixed";
    btn.style.bottom = "10px";
    btn.style.left = "140px";
    btn.style.zIndex = "999999";
    btn.onclick = () => printMetrics();
    document.body.appendChild(btn);
  }
}

