// --- Wayne setup ------------------------------------------------
import { Wayne } from '/ngapp/wayne.js';

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
  dandi: { token: null, header: {} },
  linc: { token: null, header: {} }
};
const channel_dandi_auth = new BroadcastChannel('channel-dandi-auth');

// Check that credentials are valid
async function dandiCheckCredentials(instance) {
  const api = dandi_api[instance];
  const url = api + "/auth/token/";
  const req = new Request(url, { headers: dandi_auth[instance].header });
  const res = await fetch(req);
  return res.ok;
}

// Receive credentials from the main thread
channel_dandi_auth.onmessage = async (event) => {
  // Page unloaded/reloaded -> replace undefined by null to prompt again
  if (event.data.reset_if_undefined) {
    if (!dandi_auth.dandi.token) {
      dandi_auth.dandi.token = null;
    }
    if (!dandi_auth.linc.token) {
      dandi_auth.linc.token = null;
    }
  }
  // Prompt response
  const instance = event.data.instance;
  if (event.data.token !== undefined) {
    dandi_auth[instance].token = event.data.token;
    dandi_auth[instance].header = event.data.header;
    if (!(await dandiCheckCredentials(instance))) {
      dandi_auth[instance].token = null;
      dandi_auth[instance].header = {};
    }
  // Prompt canceled or empty -> store undefined to avoid asking again
  } else {
    dandi_auth[instance].token = undefined;
  }
  channel_dandi_auth.postMessage({ receipt: true });
};

const delay = ms => new Promise(res => setTimeout(res, ms));

async function dandiAuth(instance) {
  // We check for null, because undefined is interpreted as users
  // not willing to enter credentials.
  while (dandi_auth[instance].token === null) {
    channel_dandi_auth.postMessage({ instance: instance });
    await delay(500);
  }
  return dandi_auth[instance].header;
}

async function dandiZarrURL(api, asset_id, path, opt, auth = (async () => { return {}; })) {
  const url_info = `${ api }/assets/${ asset_id }/info/`;
  let res = await fetch(new Request(url_info, opt));
  if (res.status == 401) {
    console.log("fetch -> auth");
    res = await fetch(new Request(url_info, { headers: await auth() }));
  }
  if (res.status == 401) {
    return undefined;
  }
  const json = await res.json();
  const zarr_id = json.zarr;
  return `${ api }/zarr/${ zarr_id }/files?prefix=${ path }&download=true`;
}

async function lincZarrURL(api, asset_id, path, opt) {
  const url_info = `${ api }/assets/${ asset_id }/info/`;
  const res = await fetch(new Request(url_info, opt));
  if (res.status == 401) {
    return undefined;
  }
  const json = await res.json();
  const zarr_id = json.zarr;
  return `${ api }/zarr/${ zarr_id }/files?prefix=${ path }&download=true`;
}
// ----------------------------------------------------------------


// --- capture LINC links -----------------------------------------
async function route_linc(req, res) {
  // Single asset (plain or zarr file) -> add auth headers and fetch
  console.log(`route_linc: ${ req.url}`);
  res.fetch(new Request(req, { headers: await dandiAuth("linc") }));
}

async function route_linc_zarr(req, res) {
  // There is something after /download/ so this is likely a zarr file
  // -> we need to fetch the zarr if and redirect to the zarr file link
  console.log(`route_linc_zarr: ${ req.url }"`);
  const api = dandi_api.linc;
  const asset_id = req.params.asset_id;
  const prefix = `${ api }/assets/${ asset_id }/download/`;
  const path = req.url.slice(prefix.length);

  if (!path) {
    // Nothing after /download/ -> defer to single asset route
    return await route_linc(req, res);
  }
  const header = await dandiAuth("linc");
  const zurl = await lincZarrURL(api, asset_id, path, { headers: header });
  console.log('zarr url:', zurl);
  if (zurl === undefined) {
    res.blob(null, { status: 401 });
  } else {
    res.redirect(zurl);
  }
}

app.get(`${ dandi_api.linc }/zarr/{zarr_id}/*`, route_linc);
app.get(`${ dandi_api.linc }/assets/{asset_id}/download/*`, route_linc_zarr);
// ----------------------------------------------------------------

// --- capture DANDI links ----------------------------------------
async function route_dandi(req, res) {
  console.log(`route_dandi: ${ req.url }`);
  let header = dandi_auth.dandi.header;
  if (!(header.length)) {
    const head = await fetch(req, { method: "HEAD" });
    console.log("head", head);
    if (head.status == 401) {
      console.log("head -> auth");
      header = await dandiAuth("dandi");
    }
  }
  res.fetch(new Request(req, { headers: header }));
}

async function route_dandi_zarr(req, res) {
  console.log(`route_dandi_zarr: ${ req.url}`);
  const api = dandi_api.dandi;
  const asset_id = req.params.asset_id;
  const prefix = `${ api }/assets/${ asset_id }/download/`;
  const path = req.url.slice(prefix.length);

  if (!path) {
    return await route_dandi(req, res);
  }
  const header = { headers: dandi_auth.dandi.header };
  const auth = (async () => { return await dandiAuth("dandi"); });
  const zurl = await dandiZarrURL(api, asset_id, path, header, auth);
  if (zurl === undefined) {
    res.blob(null, { status: 401 });
  } else {
    res.redirect(zurl);
  }
}

app.get(`${ dandi_api.dandi }/zarr/{zarr_id}/*`, route_dandi);
app.get(`${ dandi_api.dandi}/assets/{asset_id}/download/*`, route_dandi_zarr);
// ----------------------------------------------------------------
