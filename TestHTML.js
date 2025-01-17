import("https://unpkg.com/diff@5.0.0/dist/diff.js");

function consoleLogMonkey() {
  console.log = function consoleLogMonkey(...args) {
    return parent.postMessage(JSON.stringify([location.hash.substr(1), ...args]), '*');
  }
}

//todo 2. make a better view per element.  Make the link on the iframe? then, make the diff something you see when you click on it.
//language=HTML
const template = `
  <style>
    :host { display: block; height: 1em; overflow: hidden; }
    :host([ok="true"]) { border-left: 5px solid green; }
    :host([ok="false"]) { border-left: 5px solid red; }

    #diff, #code { white-space: pre-wrap; border: 4px double lightblue; }
    .added {color: green}
    .removed {color: red}
    iframe { height: 10px; width: 10px; display: inline-block; }

    :host([active]) { height: 60vh; overflow: scroll; }
    :host([active]) iframe { height: auto; width: auto; display: block;}
    /*:host([active]) #diff, #code { display: block;}*/
  </style>
  <span id="title"></span><a id="link" target="_blank">(=> new tab)</a> <a id="clipboard">[copy JSON-result]</a>
  <iframe id="iframe"></iframe>
  <div id="diff"></div>
  <div id="code"></div>
`;

class TestHTML extends HTMLElement {

  static stringify(ar){
    return `\n    [\n${ar.map(row => `      ${JSON.stringify(row)}`).join(',\n')}\n    ]\n`;
  }

  static #count = 0;
  #id = TestHTML.#count++;

  #resultObj = [];
  #expected;

  constructor() {
    super();
    this.attachShadow({mode: "open"});
    this.shadowRoot.innerHTML = template;
    this.#expected = this.children[0];
    window.addEventListener('message', e => this.onMessage(e));
    this.shadowRoot.addEventListener('dblclick', e => this.onDblclick(e));
    this.shadowRoot.getElementById('clipboard').addEventListener('click',
      _ => navigator.clipboard.writeText(TestHTML.stringify(this.#resultObj))
    );
  }

  onMessage(e) {
    const res = JSON.parse(e.data);
    if (!(res instanceof Array) || res.shift() !== this.#id + '')
      return;
    this.#resultObj.push(res.length === 1 ? res[0] : res);
    this.render();
  }

  render() {
    const result = TestHTML.stringify(this.#resultObj);
    const expected = TestHTML.stringify(JSON.parse(this.#expected.textContent));
    this.setAttribute('ok', expected === result);
  }

  onDblclick() {
    this.hasAttribute('active') ? this.removeAttribute('active') : this.setAttribute('active', '');
  }

  onActive() {
    const r = TestHTML.stringify(this.#resultObj);
    const e = TestHTML.stringify(JSON.parse(this.#expected.textContent));
    this.shadowRoot.getElementById("diff").innerHTML =
      Diff.diffWords(e, r).map(p => `<span class="${p.added ? 'added' : p.removed ? 'removed' : ''}">${p.value}</span>`).join('');
  }

  async onTest(newValue) {
    //load the text content for the newValue of the test.
    this.shadowRoot.getElementById("title").textContent = newValue.substr(newValue.lastIndexOf('/') + 1);
    const testUrl = new URL(newValue, document.location);
    this.shadowRoot.getElementById("link").setAttribute('href', testUrl);
    const testTxt = await (await fetch(testUrl)).text();
    this.shadowRoot.getElementById("code").textContent = testTxt;
    const txt = `<base href='${testUrl}'/><script>(${consoleLogMonkey.toString()})();</script>${testTxt}`;
    this.shadowRoot.getElementById("iframe").src = `data:text/html;charset=utf-8,${encodeURIComponent(txt)}#${this.#id}`;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'test')
      this.onTest(newValue);
    else if (name === 'active' && newValue !== null)
      this.onActive();
  }

  static get observedAttributes() {
    return ['test', 'active'];
  }
}

try{
  customElements.define('test-html', TestHTML);
} catch(err){
  //test-html already defined.
}
