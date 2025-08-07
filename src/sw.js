// --- Wayne setup ------------------------------------------------
importScripts('https://cdn.jsdelivr.net/npm/@jcubic/wayne/index.umd.min.js');

const app = new wayne.Wayne();
// ----------------------------------------------------------------

// // --- Pyodide setup ----------------------------------------------
// importScripts('https://cdn.jsdelivr.net/pyodide/v0.28.1/full/pyodide.js')

// async function main(){
//     let pyodide = await loadPyodide();
//     await pyodide.loadPackage("micropip");
//     const micropip = pyodide.pyimport("micropip");
//     await micropip.install("ngtools-pyscript==0.0.0b5");
//     await micropip.install("typing-extensions")
//     await micropip.install("httpfs-sync");
//     await micropip.install("yarl");
//     await micropip.install("nitransforms");
//     // await micropip.install("h5py");
//     return pyodide;
// }
// let pyodideReadyPromise = main();
// // ----------------------------------------------------------------

// --- /linc/ & /dandi/ utilities ---------------------------------
const dandi_max_trials = 3;
const dandi_api = {
  dandi: "https://api.dandiarchive.org/api",
  linc: "https://api.lincbrain.org/api"
};
let dandi_header = { dandi: {}, linc: {} };

async function checkDandiCredentials(instance, token) {
    const api = dandi_api.get(instance);
    const url = api + "/auth/token/";
    const req = new Request(url, { headers: { Authorization: "token " + token } });
    const res = await fetch(req);
    return res.ok;
}

async function getDandiCredentials(instance) {
  for (let trial = 0; trials < dandi_max_trials; trial++) {
    token = window.prompt("Token (" + instance + ")");
    if (await checkcheckDandiCredentials(instance, token)) {
      dandi_header.set(instance, { Authorization : "token " + token });
      return true;
    }
  }
  return false;
}
// ----------------------------------------------------------------

// --- /linc/ API -------------------------------------------------
app.get('/linc/{url}', async (req, res) => {
  const header = dandi_header.linc;
  if (!header.length) {
    getDandiCredentials("linc");
  }
  res.fetch(new Request(url, { header: header }));
});
// ----------------------------------------------------------------

// --- /dandi/ API ------------------------------------------------
app.get('/dandi/{url}', async (req, res) => {
  const opt = {};
  if (dandi_header.dandi.length) {
    opt.header = dandi_header.dandi;
  }
  try {
    res.fetch(new Request(url, opt));
  } catch(error) {
    if (getDandiCredentials("dandi")) {
      opt.header = dandi_header.dandi;
      res.fetch(new Request(url, opt));
    }
  }
});
// ----------------------------------------------------------------
