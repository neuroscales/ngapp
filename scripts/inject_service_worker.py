from argparse import ArgumentParser
from bs4 import BeautifulSoup

code = """
if ('serviceWorker' in navigator) {
    const scope = location.pathname.replace(/\/[^\/]+$/, '/');
    navigator.serviceWorker.register('/ngapp/sw.js', { scope: '/ngapp/', type: 'module' })
             .then(function(reg) {
                 reg.addEventListener('updatefound', function() {
                     const installingWorker = reg.installing;
                     console.log('A new service worker is being installed:',
                                 installingWorker);
                 });
                 // registration worked
                 console.log('Registration succeeded. Scope is ' + reg.scope);
             }).catch(function(error) {
                 // registration failed
                 console.log('Registration failed with ' + error);
             });
}

const dandi_max_trials = 3;
const dandi_api = {
  dandi: "https://api.dandiarchive.org/api",
  linc: "https://api.lincbrain.org/api"
};

async function dandiCheckCredentials(instance, token) {
    const api = dandi_api.get(instance);
    const url = api + "/auth/token/";
    const req = new Request(url, { headers: { Authorization: "token " + token } });
    const res = await fetch(req);
    return res.ok;
}

async function dandiGetCredentials(instance) {
  for (let trial = 0; trial < dandi_max_trials; trial++) {
    token = window.prompt("Token (" + instance + ")");
    if (await dandiCheckCredentials(instance, token)) {
      return { Authorization : "token " + token };
    }
  }
  return {};
}

addEventListener("dandi_auth", async function (event) => {
    return await dandiGetCredentials(this);
});
"""

p = ArgumentParser("Inject service worker into a html file.")
p.add_argument('-i', '--input', default='index.html')
p.add_argument('-o', '--output', default=None)
p.add_argument('-s', '--script', default='sw.js')
args = p.parse_args()

code = code.replace('sw.js', args.script)

with open(args.input, "rt") as f:
  html = BeautifulSoup(f.read())

script = html.new_tag('script')
script.append(code)
html.find('head').insert(0, script)

with open(args.output or args.input, "wt") as f:
  f.write(html.prettify())
