// --- Wayne setup ------------------------------------------------
import { Wayne } from '/wayne.js';

const app = new Wayne();
// ----------------------------------------------------------------

app.get(`/wayne/*`, async (req, res) => {
  console.log(`wayne: ${ req.url }`);
});

app.get(`https://github.com/{user}/{repo}`, async (req, res) => {
  console.log(`github: ${ req.params.user }/${ req.params.repo }`);
});

app.get(`https://github.com/{user}/{repo}/*`, async (req, res) => {
  console.log(`github: ${ req.params.user }/${ req.params.repo }`);
});

// addEventListener('install', event => {
//     event.waitUntil(self.skipWaiting());
// });

// addEventListener('activate', event => {
//     event.waitUntil(self.clients.claim());
// });

// --- linc & dandi utilities -------------------------------------
const dandi_api = {
  dandi: "https://api.dandiarchive.org/api",
  linc: "https://api.lincbrain.org/api",
};
const dandi_auth = {
  dandi: { token: "", header: {} },
  linc: { token: "", header: {} }
};
const channel_dandi_auth = new BroadcastChannel('channel-dandi-auth');

async function dandiCheckCredentials(instance) {
  console.log(`dandiCheckCredentials(${instance})`);
  const api = dandi_api[instance];
  const url = api + "/auth/token/";
  const req = new Request(url, { headers: dandi_auth[instance].header });
  const res = await fetch(req);
  return res.ok;
}

// Receive credentials from the main thread
channel_dandi_auth.onmessage = async (event) => {
  console.log("SW receive message:", event.data);
  const instance = event.data.instance;
  dandi_auth[instance].token = event.data.token;
  dandi_auth[instance].header = event.data.header;

  if (!(await dandiCheckCredentials(instance))) {
    console.log("Wrong credential");
    dandi_auth[instance].token = "";
    dandi_auth[instance].header = {};
  }
  console.log(dandi_auth[instance]);
  channel_dandi_auth.postMessage({ receipt: true });
};

const delay = ms => new Promise(res => setTimeout(res, ms));

async function dandiAuth(instance) {
  console.log(`dandiAuth(${instance})`);
  while (Object.keys(dandi_auth[instance].header).length == 0) {
    console.log(`ask for auth`);
    channel_dandi_auth.postMessage({ instance: instance });
    await delay(500);
  }
  return dandi_auth[instance].header;
}

async function dandiZarrURL(api, asset_id, path, opt, auth = (async () => { return {}; })) {
  const url_info = `${ api }/assets/${ asset_id }/info/`;
  console.log('opt', opt);
  let res = await fetch(new Request(url_info, opt));
  console.log('info res', res);
  if (res.status == 401) {
    const headers = await auth();
    opt.headers = headers;
    console.log(opt, headers);
    res = await fetch(new Request(url_info, opt));
    console.log('post auth info res', res);
  }
  const json = await res.json();
  console.log('json', json);
  const zarr_id = json.zarr;
  return `${ api }/zarr/${ zarr_id }/files?prefix=${ path }&download=true`;
  // return new Request(url_zarr, opt);
}

async function lincZarrURL(api, asset_id, path, opt) {
  const url_info = `${ api }/assets/${ asset_id }/info/`;
  console.log('opt', opt);
  let res = await fetch(new Request(url_info, opt));
  console.log('info res', res);
  const json = await res.json();
  console.log('json', json);
  const zarr_id = json.zarr;
  return `${ api }/zarr/${ zarr_id }/files?prefix=${ path }&download=true`;
  // return new Request(url_zarr, opt);
}
// ----------------------------------------------------------------


// --- capture LINC links -----------------------------------------
async function route_linc(req, res) {
  console.log(`route_linc: ${ req.url}`);
  const header = await dandiAuth("linc");
  console.log('header:', header);
  res.fetch(new Request(req, { headers: header }));
}

async function route_linc_zarr(req, res) {
  console.log(`route_linc_zarr: ${ req.url} | path="${ req.params.path }"`);
  console.log('original request:', req);
  if ( req.params.path == "" ) {
    return await route_linc(req, res);
  }
  const api = dandi_api.linc;
  const asset_id = req.params.asset_id;
  const path = req.params.path;
  const header = await dandiAuth("linc");
  console.log('prezarr header', header);
  const zurl = await lincZarrURL(api, asset_id, path, { headers: header });
  console.log('zarr url:', zurl);
  res.redirect(302, zurl);
}

app.get(`${ dandi_api.linc }/zarr/{zarr_id}/*`, route_linc);
app.get(`${ dandi_api.linc }/assets/{asset_id}/download`, route_linc);
app.get(`${ dandi_api.linc }/assets/{asset_id}/download/{path}`, route_linc_zarr);
// ----------------------------------------------------------------

// --- capture DANDI links ----------------------------------------
async function route_dandi(req, res) {
  console.log(`route_dandi: ${ req.url}`);
  if (!dandi_header.dandi.length) {
    const head = await fetch(req, { method: "HEAD" });
    if (head.status == 401) {
      await dandiAuth("dandi");
    }
  }
  res.fetch(new Request(req, { headers: dandi_auth.dandi.header }));
}

async function route_dandi_zarr(req, res) {
  console.log(`route_dandi_zarr: ${ req.url}`);
  if ( req.params.path == "" ) {
    return await route_dandi(req, res);
  }
  const api = dandi_api.dandi;
  const asset_id = req.params.asset_id;
  const path = req.params.path;
  const auth = (async () => { return await dandiAuth("dandi"); });
  const zurl = await dandiZarrRequest(api, asset_id, path, {}, auth);
  res.redirect(302, zurl);
}

app.get(`${ dandi_api.dandi }/zarr/{zarr_id}/*`, route_dandi);
app.get(`${ dandi_api.dandi }/assets/{asset_id}/download`, route_dandi);
app.get(`${ dandi_api.dandi}/assets/{asset_id}/download/{path}`, route_dandi_zarr);
// ----------------------------------------------------------------
