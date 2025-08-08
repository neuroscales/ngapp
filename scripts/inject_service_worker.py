from argparse import ArgumentParser
from bs4 import BeautifulSoup

code_head = """
<script>
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

    // get auth message from service worker
    const channel_dandi_auth = new BroadcastChannel('channel-dandi-auth');
    let dandi_prompting = false;
    let dandi_message_received = true;

    channel_dandi_auth.onmessage = (event) => {
      // acknowledge message was received
      if (event.data.receipt) {
        dandi_message_received = true;
        return
      }
      // otherwise, it's a prompt query
      if (dandi_prompting || !dandi_message_received) {
        return;
      }
      dandi_prompting = true;
      const token = window.prompt("Token (" + event.data.instance + ")");
      dandi_message_received = false;
      if (token) {
        channel_dandi_auth.postMessage({
          instance: event.data.instance,
          token: token,
          header: { Authorization: "token " + token }
        });
      } else {
        channel_dandi_auth.postMessage({
          instance: event.data.instance,
          token: undefined,
        });
      }
      dandi_prompting = false;
    };

    window.onbeforeunload = (event) => {
      channel_dandi_auth.postMessage({ reset_if_undefined: true });
    };

    // start accepting messages from worker
    navigator.serviceWorker.startMessages();
}
</script>
"""

code_body = """
<dialog id="dandi-auth-dialog">
  <form method="dialog">
    <p>
      <label id="dandi-auth-prompt">
        <span>Enter your <b>{instance}</b> Token: </span>
        <input type="text" required />
      </label>
    </p>
    <div>
      <button id="dandi-auth-cancel">Cancel</button>
      <button id="dandi-auth-ok">OK</button>
    </div>
  </form>
</dialog>

<script>
const channel_dandi_auth = new BroadcastChannel('channel-dandi-auth');
let dandi_prompting = false;
let dandi_message_received = true;

// setup dialog box
const dandiDialog = document.getElementById("dandi-auth-dialog");
const dandiLabel = document.getElementById("dandi-auth-prompt");
const dandiOK = dandiDialog.querySelector("#dandi-auth-ok");
const dandiCancel = dandiDialog.querySelector("#dandi-auth-cancel");
const dandiToken = dandiLabel.getElementsByTagName("input")[0];
const dandiInstance = dandiLabel.getElementsByTagName("span")[0].getElementsByTagName("b")[0];

dandiDialog.addEventListener("close", (e) => {
  dandi_prompting = false;
});

dandiOK.addEventListener("click", (e) => {
  dandiDialog.close();
  dandi_message_received = false;
  const instance = dandiInstance.textContent.toLocaleLowerCase();
  const token = dandiToken.value;
  if (token) {
    channel_dandi_auth.postMessage({
      instance: instance,
      token: token,
      header: { Authorization: "token " + token }
    });
  } else {
    channel_dandi_auth.postMessage({
      instance: instance,
      token: undefined,
    });
  }
});

dandiCancel.addEventListener("click", (e) => {
  dandiDialog.close();
  dandi_message_received = false;
  const instance = dandiInstance.textContent.toLocaleLowerCase();
  channel_dandi_auth.postMessage({
    instance: instance,
    token: undefined,
  });
});

// two-way communication
channel_dandi_auth.onmessage = (event) => {
  if (event.data.receipt) {
    // acknowledge message was received
    dandi_message_received = true;
    return
  }
  else if (dandi_prompting || !dandi_message_received) {
    // do not prompt while we're already prompting or waiting
    return;
  }
  // otherwise, it's a valid prompt query
  dandi_prompting = true;
  const dandiDialog = document.getElementById("dandi-auth-dialog");
  const dandiLabel = document.getElementById("dandi-auth-prompt");
  const dandiInstance = dandiLabel.getElementsByTagName("span")[0].getElementsByTagName("b")[0];
  dandiInstance.textContent = event.data.instance.toUpperCase();
  dandiDialog.showModal();
};

window.onbeforeunload = (event) => {
  channel_dandi_auth.postMessage({ reset_if_undefined: true });
};

// start accepting messages from worker
navigator.serviceWorker.startMessages();
</script>
"""

p = ArgumentParser("Inject service worker into a html file.")
p.add_argument('-i', '--input', default='index.html')
p.add_argument('-o', '--output', default=None)
p.add_argument('-s', '--script', default='sw.js')
args = p.parse_args()

code = code.replace('sw.js', args.script)

with open(args.input, "rt") as f:
  html = BeautifulSoup(f.read())

html.find('head').insert(0, code_head)
html.find('body').insert(0, code_body)

with open(args.output or args.input, "wt") as f:
  f.write(html.prettify())
