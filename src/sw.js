// --- Wayne setup ------------------------------------------------
import { Wayne } from '/ngapp/wayne.js';

const app = new Wayne();
// ----------------------------------------------------------------

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

function dandiAuthReset(instance) {
  if (!instance) {
    dandiAuthReset("dandi");
    dandiAuthReset("linc");
    return;
  }
  dandi_auth[instance].token = null;
  dandi_auth[instance].header = {};
}

function dandiAuthResetIfDefined(instance) {
  if (!instance) {
    dandiAuthResetIfDefined("dandi");
    dandiAuthResetIfDefined("linc");
    return;
  }
  if (dandi_auth[instance].token) {
    dandi_auth[instance].token = null;
    dandi_auth[instance].header = {};
  }
}

function dandiAuthResetIfUndefined(instance) {
  if (!instance) {
    dandiAuthResetIfUndefined("dandi");
    dandiAuthResetIfUndefined("linc");
    return;
  }
  if (!(dandi_auth[instance].token)) {
    dandi_auth[instance].token = null;
    dandi_auth[instance].header = {};
  }
}

// Receive credentials from the main thread
channel_dandi_auth.onmessage = async (event) => {
  if (event.data.reset_if_undefined) {
    // Page unloaded/reloaded -> replace undefined by null to prompt again
    dandiAuthResetIfUndefined();
    return;
  }
  const instance = event.data.instance;
  if (event.data.token !== undefined) {
    // Prompt response
    dandi_auth[instance].token = event.data.token;
    dandi_auth[instance].header = event.data.header;
    if (!(await dandiCheckCredentials(instance))) {
      dandiAuthReset(instance);
    }
  } else {
    // Prompt canceled or empty -> store undefined to avoid asking again
    dandi_auth[instance].token = undefined;
  }
  // Acknowledge reception
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

async function dandiZarrURL(api, asset_id, path, opt, instance) {
  const url_info = `${ api }/assets/${ asset_id }/info/`;
  let res = await fetch(new Request(url_info, opt));
  if (res.status == 401 && dandi_auth[instance].token !== undefined) {
    console.log("fetch -> auth");
    dandiAuthReset(instance);
    const header = await dandiAuth(instance);
    res = await fetch(new Request(url_info, { headers: header }));
  }
  if (res.status == 401) {
    return undefined;
  }
  const json = await res.json();
  const zarr_id = json.zarr;
  return `${ api }/zarr/${ zarr_id }/files?prefix=${ path }&download=true`;
}
// ----------------------------------------------------------------


// --- capture DANDI links ----------------------------------------
async function route_dandi_instance(req, res, instance) {
  // Single asset (plain or zarr file) -> add auth headers and fetch
  console.log(`route_${ instance }: ${ req.url }`);

  if (dandi_auth[instance].token === null) {
    const head = await fetch(req, { method: "HEAD" });
    if (head.status == 401) {
      console.log("head -> auth");
      await dandiAuth(instance);
    }
  }

  res.fetch(new Request(req, { headers: dandi_auth[instance].header }));
}

async function route_dandi_instance_zarr(req, res, instance) {
  // There is something after /download/ so this is likely a zarr file
  // -> we need to fetch the zarr if and redirect to the zarr file link
  console.log(`route_${ instance }_zarr: ${ req.url}`);
  const api = dandi_api[instance];
  const asset_id = req.params.asset_id;
  const prefix = `${ api }/assets/${ asset_id }/download/`;
  const path = req.url.slice(prefix.length);

  if (!path) {
    return await route_dandi_instance(req, res, instance);
  }
  const opt = { headers: dandi_auth[instance].header };
  const zurl = await dandiZarrURL(api, asset_id, path, opt, instance);
  if (zurl === undefined) {
    res.blob(null, { status: 401 });
  } else {
    res.redirect(zurl);
  }
}

async function route_dandi(req, res) {
  return await route_dandi_instance(req, res, "dandi");
}

async function route_dandi_zarr(req, res) {
  return await route_dandi_instance_zarr(req, res, "dandi");
}

app.get(`${ dandi_api.dandi }/zarr/{zarr_id}/*`, route_dandi);
app.get(`${ dandi_api.dandi}/assets/{asset_id}/download/*`, route_dandi_zarr);
// ----------------------------------------------------------------



// --- capture LINC links -----------------------------------------
async function route_linc(req, res) {
  return await route_dandi_instance(req, res, "linc");
}

async function route_linc_zarr(req, res) {
  return await route_dandi_instance_zarr(req, res, "linc");
}

app.get(`${ dandi_api.linc }/zarr/{zarr_id}/*`, route_linc);
app.get(`${ dandi_api.linc }/assets/{asset_id}/download/*`, route_linc_zarr);
// ----------------------------------------------------------------
