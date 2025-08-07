// --- Wayne setup ------------------------------------------------
importScripts('https://cdn.jsdelivr.net/npm/@jcubic/wayne/index.umd.min.js');

const app = new wayne.Wayne();
// ----------------------------------------------------------------

app.get(`/wayne/*`, async (req, res) => {
  console.log(`wayne: ${ req.url }`);
});

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

// --- linc & dandi utilities -------------------------------------
const dandi_max_trials = 3;
const dandi_api = {
  dandi: "https://api.dandiarchive.org/api",
  linc: "https://api.lincbrain.org/api"
};
let dandi_header = { dandi: {}, linc: {} };

async function dandiCheckCredentials(instance, token) {
    const api = dandi_api.get(instance);
    const url = api + "/auth/token/";
    const req = new Request(url, { headers: { Authorization: "token " + token } });
    const res = await fetch(req);
    return res.ok;
}

async function dandiGetCredentials(instance) {
  for (let trial = 0; trials < dandi_max_trials; trial++) {
    token = window.prompt("Token (" + instance + ")");
    if (await dandiCheckCredentials(instance, token)) {
      dandi_header.set(instance, { Authorization : "token " + token });
      return dandi_header.get(instance);
    }
  }
  return dandi_header.get(instance);
}

async function dandiZarrRequest(api, asset_id, path, opt, auth = (async () => { return {}; })) {
  const url_info = `${ api }/assets/${ asset_id }/info/`;
  let res = await fetch(new Request(url_info, opt));
  if (res.status == 401) {
    opt.headers = await auth();
    res = await fetch(new Request(url_info, opt));
  }
  const zarr_id = (await res.json()).zarr;
  const url_zarr = `${ api }/zarr/${ zarr_id }/files?prefix=${ path }&download=true`;
  return new Request(url_zarr, opt);
}
// ----------------------------------------------------------------

// --- capture LINC links -----------------------------------------
async function route_linc(req, res) {
  console.log(`route_linc: ${ req.url}`);
  if (!dandi_header.linc.length) {
    dandiGetCredentials("linc");
  }
  res.fetch(new Request(req.url, { headers: dandi_header.linc }));
}

async function route_linc_zarr(req, res) {
  console.log(`route_linc_zarr: ${ req.url}`);
  if ( req.params.path == "" ) {
    return await route_linc(req, res);
  }
  if (!dandi_header.linc.length) {
    dandiGetCredentials("linc");
  }
  if ( req.params.path == "" ) {
    res.fetch(new Request(req.url, { headers: dandi_header.linc }));
  }
  const opt = { headers: dandi_header.linc };
  const api = dandi_api.linc;
  res.fetch(await dandiZarrRequest(api, req.params.asset_id, req.params.path, opt));
}

app.get(`${ dandi_api.linc }/assets/{asset_id}/download`, route_linc);
app.get(`${ dandi_api.linc }/assets/{asset_id}/download/{path}`, route_linc_zarr);

// ----------------------------------------------------------------

// --- capture DANDI links ----------------------------------------
async function route_dandi(req, res) {
  console.log(`route_dandi: ${ req.url}`);
  if (!dandi_header.dandi.length) {
    const head = await fetch(req.url, { method: "HEAD" });
    if (head.status == 401) {
      dandiGetCredentials("dandi");
    }
  }
  res.fetch(new Request(req.url, { headers: dandi_header.dandi }));
}

async function route_dandi_zarr(req, res) {
  console.log(`route_dandi_zarr: ${ req.url}`);
  if ( req.params.path == "" ) {
    res.fetch(new Request(req.url, { headers: dandi_header.dandi }));
  }
  const opt = {};
  const api = dandi_api.dandi;
  const auth = (async () => { return dandiGetCredentials("dandi"); });
  res.fetch(await dandiZarrRequest(api, req.params.asset_id, req.params.path, opt, auth));
}

app.get(`${ dandi_api.dandi }/assets/{asset_id}/download`, route_dandi);
app.get(`${ dandi_api.dandi }/assets/{asset_id}/download/{path}`, route_dandi_zarr);
// ----------------------------------------------------------------
