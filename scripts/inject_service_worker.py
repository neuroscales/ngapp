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
