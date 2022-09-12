const canv = Array.from(document.getElementsByTagName('canvas'));
const ctx = canv.map(x => x.getContext('2d'));
const w = 800;
const h = 450;
canv.forEach(x => x.width = w);
canv.forEach(x => x.height = h);
const gamename = "Rhythmic Bullets";
const uidiv = document.querySelector(".ui");
const creditdiv = document.querySelector(".credits");
const editdiv = {
  main: document.querySelector(".edit"),
  timeline: document.querySelector(".timeline"),
  thead: document.querySelector(".timeline .head"),
  tbody: document.querySelector(".timeline .body"),
  tcur: document.querySelector(".timeline .cursor"),
  inspect: document.querySelector(".inspect"),
  insgeneral: document.querySelector(".inspect .general"),
  insadd: document.querySelector(".inspect .add"),
  insedit: document.querySelector(".inspect .edit"),
  insexport: document.querySelector(".inspect .export"),
  ihead: document.querySelector(".inspect .head"),
  ibody: document.querySelector(".inspect .body")
}
const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const no_die = false;
const debug = false;

const {
  PI,
  sin,
  cos,
  tan,
  asin,
  acos,
  atan,
  sqrt,
  floor,
  round,
  ceil,
  random,
  abs,
  min,
  max
} = Math;

const AudioContext = window.AudioContext || window.webkitAudioContext;
const actx = new AudioContext();

const gain = actx.createGain();
gain.gain.value = parseFloat(uidiv.children[0].value);

const aud = document.querySelector('audio');
const track = actx.createMediaElementSource(aud);
track.connect(gain).connect(actx.destination);
const deathsound = document.getElementById('deathsound');
const dstrack = actx.createMediaElementSource(deathsound);
dstrack.connect(gain).connect(actx.destination);

function loadlevel(n) {
  clevel = n;
  readlevel(n).then(x => {
    levels[n] = x;
    console.log(aud);
    // if(!aud){
    aud.oncanplay = () => {
      console.log("finish");
      loading = false;
      levelstarttime = ts;
    };
    aud.src = "audio/" + x.audio;
    // }
  })
}
function readlevel(n) {
  let proc = x => {
    calcmspb(x.bpm);
    console.log(x.bpm, mspb);
    x.offset = x.offset || 0;
    x.events.forEach(m => {
      let beat = m.beat.split(",");
      m.time = (parseInt(beat[0]) * 4 + parseFloat(beat[1]) - 1) * mspb + x.offset;
      console.log(beat, m.time);
      if (m.duration) m.duration *= mspb;
      if (m.offset) m.offset *= mspb;
      if (m.element) {
        m.element.fadeout *= mspb;
        m.element.kill *= mspb;
      }
      if (m.elements) {
        m.elements.forEach(f => {
          f.fadeout *= mspb;
          f.kill *= mspb;
        })
      }
      if (m.repeat) m.repeat[1] *= mspb;
    })
    return x;
  }
  console.log(n);
  return new Promise((res, rej) => {
    fetch("levels/level" + n + ".json", { cache: "no-store" })
      .then(x => x.json()).then(proc).then(x => res(x)).catch(rej);
  });
};
function initlevel(data) {
  let chunks = data.split("###");
  readlevel(JSON.parse(chunks.splice(0, 1)[0]));
  uploads = chunks.map(x => {
    let type = x.split(" ")[0];
    let data = x.split(" ").slice(1).join(" ");
    return {
      type,
      data: type == "img" ? new Image(data) : data
    }
  })
}
function reset() {
  aud.currentTime = 0;
  cdata = {
    movementradius: 1,
    movementcenterx: w / 2,
    movementcentery: h / 2,
    circleglow: .5,
    cslide: [],
    futurespawns: [],
    repeatevents: [],
    indicators: [],
    aplaying: false,
    movement: 0
  };
  obstacles = [];
  levelstarttime = ts;
  totalpause = 0;
  nextmet = ts;
  levels.forEach(x =>
    x.events = x.events.map(y => ({ ...y, triggered: false }))
  );
  deatheff = {
    active: false,
    time: 0,
    x: 0,
    y: 0,
    obj: []
  }
};
function death(a) {
  if (immortal) return;
  view = "death";
  deathsound.play();
  deathtime = ts;
  deatheff = {
    active: true,
    time: ts,
    x: plpos[0],
    y: plpos[1],
    obj: " ".repeat(10).split("").map(() => ({
      x: plpos[0],
      y: plpos[1],
      speed: random() * 5 + 2,
      ang: random() * PI / 2 - PI / 4 + a,
      rad: random() * 5 + 10,
      rot: [random() * 2 * PI, randint(0, 1) ? 1 : -1],
      shape: ["circle", "square", "triangle"][randint(0, 2)]
    }))
  };
  console.log({ ...deatheff });
};
function updatebeats(lvl) {
  [...(document.querySelectorAll(".beat") || [])].forEach(x => x.remove());
  if (!mspb) calcmspb(lvl);
  updateevents()
  " ".repeat(ceil(aud.duration * 2)).split("").forEach((_, i) => {
    let pos = (i * mspb) / zoom - toff;
    if (pos > w || pos < 0) return;
    let e = document.createElement("div");
    e.className = "beat";
    e.style.left = pos + "px";
    e.onmousemove = e => {
      console.log(e.buttons, i, i * mspb)
      if (e.buttons & 1)
        aud.currentTime = i * mspb;
    }
    e.innerHTML = floor(i / 4) + "." + floor(i % 4 + 1);
    editdiv.thead.appendChild(e);
  });
}
function updateevents() {
  [...(document.querySelectorAll(".event"))].forEach(x => x.remove());
  editor.events.forEach((x, i) => {
    let pos = (x.time) / zoom - toff;
    if ((pos < 0 && x.repeat ? (x.repeat[0] * x.repeat[1]) / zoom < pos : false) || pos > w) return;
    let e = document.createElement("div");
    e.className = (selected == i ? "select " : "") + "event " + x.type;
    e.style.left = pos + "px";
    e.style.setProperty("--layer", [
      "",
      "",
      "spawn",
      "movementradius",
      "movementcenterx",
      "movementcentery",
      "circleglow"
    ].indexOf(x.type) || 1);
    if (x.repeat) {
      e.style.filter = ("drop-shadow(" +
        (" ".repeat(x.repeat[0]).split("").map((_, i) => ((i + 1) * x.repeat[1] / zoom) + "px 0px 0px #555").join(") drop-shadow(")) +
        ")")
    }
    e.addEventListener("click", () => {
      selected = i;
      updateevents();
      editdiv.inspect.className = 'inspect edit';
      updateinspect();
    })
    editdiv.tbody.appendChild(e);
  });
}
function updateinspect() {
  let sel = editor.events[selected];
  if (!sel) {
    editdiv.insedit.innerHTML = "Select an Event to start editing.";
  } else {
    if (sel.type == "spawn") {
      editdiv.insedit.innerHTML = `
      Event ${selected + 1}: ${sel.type}<br>
      <input type="number" value="${sel.time}" onchange="editor.events[${selected}].time=parseFloat(this.value);updateevents()"> Time<br>
      Element: ${JSON.stringify(sel.element || sel.elements)}<br>
      `;
    }
  }
}

const transitions = {
  linear: p => p,
  sineinout: p => -cos(p * PI) / 2 + .5,
  sinein: p => 1 - cos(p * PI / 2),
  sineout: p => sin(p * PI / 2),
  quadinout: p => p < .5 ? transitions.quadin(p) * 2 : transitions.quadout(p) * 2 - 1,
  quadin: p => p ** 2,
  quadout: p => 1 - (1 - p) ** 2,
}

const menuobstfunc = (x, y, t, c) => [
  w / 2 + sin(t / 360 + c.ang) * (t / 36),
  h / 2 + cos(t / 360 + c.ang) * (t / 36)
];

jsontoobj = x => {
  let movefunc = new Function("x,y,t,c,w,h", "/*console.log(arguments); */return [" + x.movex + "," + x.movey + "];");
  return new Bullet(
    x.shape,
    (x.x || 0) * w,
    (x.y || 0) * h,
    x.rad,
    movefunc,
    x.fadeout,
    x.kill,
    x.custom
  );
}

document.getElementById("importfile").onchange = e => {
  if (e.target.files.length == 0) return alert('Error: No file selected');
  var file = e.target.files[0];
  if (!file.name.endsWith(".rblvl") && !file.name.endsWith(".zip")) return alert("Must be a .rblvl file");
  var max_size_allowed = 2 * 1024 * 1024
  if (file.size > max_size_allowed) {
    alert('Error : Exceeded size 2MB');
    return;
  }
  var reader = new FileReader();
  reader.addEventListener('loadstart', () => e.target.style.display = 'none');

  reader.addEventListener('load', e => {
    var text = e.target.result;
    console.log(text);
    let chunks = text.split("###");
    editimport(JSON.parse(chunks.splice(0,1)[0]));
    uploads = chunks.map(x=>{
      let type = x.split(" ")[0];
      let data = x.split(" ").slice(1).join(" ");
      return {
        type,
        data: type == "img" ? new Image(data) : data
      }
    })
  });
  reader.addEventListener('error', () => alert('Error : Failed to read file'));
  reader.addEventListener('progress', e => {
    if (e.lengthComputable == true)
      document.querySelector(".uploadloading").style.width = Math.floor((e.loaded / e.total) * 100) + "%";
  });
  reader.readAsText(file);
}

async function editimport(obj) {
  let fin = null;
  console.log(obj);
  if (typeof obj == "object") {
    editor = obj
  }
  else if (isNaN(obj)) fin = levelinfo.findIndex(x => x.songname.toLowerCase().includes(obj))
  else fin = obj;
  editor = await readlevel(fin);
  Object.keys(editor).forEach(i => {
    let e = document.getElementById(i);
    if (e) e.value = editor[i];
  })
  console.log(editor);
  aud.src = "audio/" + editor.audio;
  aud.pause();
  calcmspb(editor.bpm);
  beatupdate = true;
}

randint = (min, max) => floor(random() * (max - min + 1)) + min;

let editor = {
  "audio": "",
  "songname": "Untitled",
  "artist": "Someone",
  "bpm": 100,
  "offset": 0,
  "events": []
}

let obstacles = [];
let view = 'menu';
let ts = 0;
let nextcenterspawn = 0;
let nextsidespawn = 0;
let speed = 1;
let mpos = [0, 0];
let lmp = [0, 0];
let lc = false;
let rc = false;
let inp = {};
let rl = false;
let animf = null;
let loading = 1;
let levelstarttime = 0;
let deathtime = 0;
let pausetime = 0;
let completetime = 0;
let totalpause = 0;
let plpos = [w / 2, h / 2];
let levels = [];
let clevel = 0;
let mspb = 0;
let immortal = false;
let bpmclicks = [];
let ct = 0;
let levelinfo = [];
let deatheff = {
  active: false,
  time: 0,
  x: 0,
  y: 0,
  obj: []
}
let cdata = {
  movementradius: 1,
  movementcenterx: w / 2,
  movementcentery: h / 2,
  circleglow: .5,
  cslide: [],
  futurespawns: [],
  repeatevents: [],
  indicators: [],
  aplaying: false,
  movement: 0
};
let menubpm = 0;
let zoom = 5;
let toff = 0;
let beatupdate = false;
let tldragstart = 0;
let selected = -1;
let uploads = [];

fetch("levels/levels.json", { cache: "no-store" }).then(x => x.json()).then(x => {
  levelinfo = x;
  loading = 0;
  menubpm = x[0].bpm;
});

let v = 0;

class Bullet {
  constructor(s, x, y, r, m, f, k, c) {
    this.s = s;
    this.x = x;
    this.y = y;
    this.r = r;
    this.st = ts - totalpause;
    this.f = f;
    this.k = k;
    this.c = {};
    this.deleted = false;
    for (let i in (c || {})) {
      this.c[i] = typeof c[i] == "object" ? randint(...c[i]) : c[i];
    };
    if (typeof m == "function") this.m = m;
    else this.m = (x, y) => [x + m[0], y + m[1]];
  }

  draw(pu, ub) {
    if (this.deleted) return;
    let et = ts - this.st - totalpause;
    // console.log(et);
    let np;
    np = this.m(
      this.x,
      this.y,
      ub ? (et / mspb) : (et * speed),
      this.c,
      w, h
    ) || [this.x, this.y];
    ctx[0].beginPath();
    let op = 1 - (et > this.f ? (et - this.f) / (this.k - this.f) : 0);
    op = op < 0 ? 0 : op;
    op = floor(op * 15).toString(16);
    let a = [np[0] - this.x, np[1] - this.y];
    if (a[0]) a = -atan(a[1] / a[0]) - PI / (a[0] < 0 ? 2 : -2);
    else a = a[1] > 0 ? 0 : -PI;
    switch (this.s) {
      case "circle":
        if (sqrt((np[0] - plpos[0]) ** 2 + (np[1] - plpos[1]) ** 2) < this.r) death(a);
        ctx[0].fillStyle = "#0ff" + op;
        ctx[0].arc(np[0], np[1], this.r, 0, 2 * PI);
        break;
      case "triangle":
        if (sqrt((np[0] - plpos[0]) ** 2 + (np[1] - plpos[1]) ** 2) < this.r * 2) death(a);
        let p = [
          [this.r * 2 * sin(a - PI / 1.5), this.r * 2 * cos(a - PI / 1.5)],
          [this.r * 3 * sin(a), this.r * 3 * cos(a)],
          [this.r * 2 * sin(a + PI / 1.5), this.r * 2 * cos(a + PI / 1.5)]
        ];
        // console.log(p);
        p = p.map(x => [round(x[0]) + np[0], round(x[1]) + np[1]]);
        // console.log(p);
        ctx[0].fillStyle = "#ff0" + op;
        ctx[0].moveTo(...p[0]);
        ctx[0].lineTo(...p[1]);
        ctx[0].lineTo(...p[2]);
        break;
      case "square":
        if (sqrt((np[0] - plpos[0]) ** 2 + (np[1] - plpos[1]) ** 2) < this.r * 2) death(a);
        ctx[0].fillStyle = "#f00" + op;
        ctx[0].beginPath();
        ctx[0].moveTo(
          np[0] + this.r * 2 * Math.sin(a),
          np[1] + this.r * 2 * Math.cos(a)
        )
        ctx[0].lineTo(
          np[0] + this.r * 2 * Math.sin(a + PI / 2),
          np[1] + this.r * 2 * Math.cos(a + PI / 2)
        )
        ctx[0].lineTo(
          np[0] + this.r * 2 * Math.sin(a + PI),
          np[1] + this.r * 2 * Math.cos(a + PI)
        )
        ctx[0].lineTo(
          np[0] + this.r * 2 * Math.sin(a - PI / 2),
          np[1] + this.r * 2 * Math.cos(a - PI / 2)
        )
        ctx[0].fill();
    }
    ctx[0].fill();
    if (!pu) {
      this.x = np[0];
      this.y = np[1];
    }
    ctx[0].fillStyle = "#000";
    // ctx[0].fillText(this.st.toFixed(1) + "\n" + et.toFixed(1), this.x, this.y)
    if (et > this.k) { this.kill(); }
  }

  kill() { this.deleted = true; }
}

function bpmdetect() {
  if (ts - bpmclicks[bpmclicks.length - 1] > 10000) bpmclicks = [];
  bpmclicks.push(ts);
  if (bpmclicks.length > 4) {
    let int = bpmclicks.map((x, i) => x - bpmclicks[i - 1]);
    let avint = int.slice(1).reduce((x, y) => x + y) / int.length;
    console.log(int, avint);
    return (60000 / avint).toFixed(2);
  }
}

function parseevent(i) {
  if (i.triggered) return;
  if (ct < i.time) return;
  console.log(i);
  if (i.type == "spawn") {
    if ("count" in i) {
      i.elements = [];
      let cus = (el, j) => {
        let fin = {};
        Object.keys(el).forEach(k => {
          if (typeof el[k] == "string")
            fin[k] = (new Function("i", "return " + el[k]))(j);
          else fin[k] = el[k];
        });
        return fin;
      }
      for (let j = 0; j < i.count; j++) {
        let el = { ...i.element };
        if (i.element.custom) el.custom = cus(i.element.custom, j)
        i.elements.push(el);
      }
      // console.log(i.count, i.element, i.elements);
    }
    if ("elements" in i) {
      //console.log(i.elements)
      if ("offset" in i) {
        cdata.futurespawns.push(
          ...i.elements.map((x, j) => ({
            elem: x,
            time: ct + i.offset * j
          }))
        )
        //console.log(cdata.futurespawns);
      } else i.elements.forEach(x => {
        console.log(x);
        obstacles.push(jsontoobj(x));
      });
    } else obstacles.push(jsontoobj(i.element));
  } else if ([
    "movementcenterx",
    "movementcentery",
    "movementradius",
    "circleglow"
  ].includes(i.type)) {
    if ("setto" in i) {
      if (i.type.startsWith("movementcenter"))
        cdata[i.type] = i.setto * i.type.endsWith("x") ? w : h;
      else cdata[i.type] = i.setto;
    }
    if ("slideto" in i && "duration" in i) {
      let el = {
        data: i.type,
        target: i.slideto,
        start: cdata[i.type],
        starttime: ct,
        endtime: ct + i.duration,
        function: transitions[i.function || "linear"]
      }
      cdata.cslide.push(el);
    }
  } else if (i.type == "clear") {
    obstacles = [];
    cdata.futurespawns = [];
  } // else if (i.type == "warning") {
  //  cdata.indicators.push({
  //    type: "warning",
  //    topx: i.topx,
  //    topy: i.topy,
  //    width: i.width,
  //    height: i.height,
  //    duration: i.duration,
  //    start: ct
  //  })
  // } else if (i.type == "help") {
  //   cdata.indicators.push({
  //     type: "help",
  //     topx: i.topx * w,
  //     topy: i.topy * h,
  //     width: i.width * w,
  //     height: i.height * h,
  //     duration: i.duration,
  //     start: ct
  //   })
  // }
  // console.log(i);
  if ("repeat" in i) {
    let { repeat, ...rest } = i;
    for (let j = 0; j < repeat[0]; j++) {
      cdata.repeatevents.push({
        ...rest,
        time: ct + repeat[1] * j,
        triggered: false
      });
    }
  }
  i.triggered = true;
}

function calcmspb(bpm) {mspb = 60000 / bpm};

function update(t) {
  ctx[0].fillStyle = "#0003";
  // ctx[0].fillRect(0, 0, w, h);
  ctx[0].clearRect(0, 0, w, h);
  ctx[1].clearRect(0, 0, w, h);
  let prog, a;
  switch (view) {
    case "menu":
      uidiv.style.display = "block";
      creditdiv.style.display = "none";
      ctx[1].textAlign = "center";
      ctx[1].font = "italic 30px Krona One";
      ctx[1].fillStyle = "#fff";
      if (loading) {
        ctx[1].fillText("Loading...", w / 2, h / 2);
        break;
      }
      immortal = true;
      // if (!canv[0].classList.contains("blur2")) canv[0].classList.add("blur2");
      speed = .3;
      if (t > nextcenterspawn) {
        obstacles.push(
          new Bullet(
            "circle",
            w / 2, h / 2, 5,
            menuobstfunc,
            20000,
            22000,
            { ang: t / 360 * PI / -5 }
          )
        );
        nextcenterspawn = t + 200;
      }
      if (t > nextsidespawn) {
        rl = !rl
        obstacles.push(
          new Bullet(
            "triangle",
            rl ? w + 10 : -10,
            (t % 2000 < 1000) == rl ?
              (t % 1000) / 1000 * h :
              (1 - (t % 1000) / 1000) * h,
            5,
            new Function(
              "x, y, t, c",
              "return [x " + (rl ? "-" : "+") + " 3, c.sy - (c.sy - h / 2) * (t / 1000)]"
            ),
            // (x, y) => [x + (rl ? -4 : 4), (h / 2 - y) / 1000],
            // [rl ? -3 : 3, 0],
            1000,
            1500,
            {
              sy: (t % 2000 < 1000) == rl ?
                (t % 1000) / 1000 * h :
                (1 - (t % 1000) / 1000) * h
            }
          )
        );
        nextsidespawn = t + 50;
      }
      obstacles.forEach(i => i.draw(false, false));
      ctx[1].textAlign = "center";
      ctx[1].font = "italic bold " + (-(t % (60000 / menubpm)) / 100 + 50) + "px Krona One";
      ctx[1].fillStyle = "#000";
      ctx[1].fillText(gamename, w / 2 + 2, h / 2 + 2);
      ctx[1].fillStyle = "#fff";
      ctx[1].fillText(gamename, w / 2, h / 2);
      ctx[1].font = "italic " + (-(t % (60000 / menubpm)) / 100 + 30) + "px Krona One";
      ctx[1].fillStyle = "#000";
      ctx[1].fillText(
        (mobile ? "Tap" : "Press Space or click") + " to start",
        w / 2 + 2, h / 1.3 + 2);
      ctx[1].fillStyle = "#fff";
      ctx[1].fillText(
        (mobile ? "Tap" : "Press Space or click") + " to start",
        w / 2, h / 1.3);
      if (inp[" "] || lc == 1) {
        view = "levels";
        canv[0].classList.remove("blur2");
        loading = true;
      }
      break;
    case "levels":
      uidiv.style.display = "block";
      creditdiv.style.display = "none";
      immortal = true;
      if (!canv[0].classList.contains("blur2")) canv[0].classList.add("blur2");
      if (t > nextcenterspawn) {
        obstacles.push(
          new Bullet(
            "circle",
            w / 2, h / 2, 5,
            menuobstfunc,
            20000,
            22000,
            { ang: t / 360 * PI / -5 }
          )
        );
        nextcenterspawn = t + 200;
      }
      if (t > nextsidespawn) {
        rl = !rl
        obstacles.push(
          new Bullet(
            "triangle",
            rl ? w + 10 : -10,
            (t % 2000 < 1000) == rl ?
              (t % 1000) / 1000 * h :
              (1 - (t % 1000) / 1000) * h,
            5,
            new Function(
              "x, y, t, c",
              "return [x " + (rl ? "-" : "+") + " 3, c.sy - (c.sy - h / 2) * (t / 1000)]"
            ),
            // (x, y) => [x + (rl ? -4 : 4), (h / 2 - y) / 1000],
            // [rl ? -3 : 3, 0],
            1000,
            1500,
            {
              sy: (t % 2000 < 1000) == rl ?
                (t % 1000) / 1000 * h :
                (1 - (t % 1000) / 1000) * h
            }
          )
        );
        nextsidespawn = t + 50;
      }
      obstacles.forEach(i => i.draw(false, false));
      let sel = floor((mpos[1] - h / 20) / (h / 15));
      // console.log(sel);
      ctx[1].textAlign = "center";
      for (i = 0; i < levelinfo.length; i++) {
        ctx[1].fillStyle = "#000";
        ctx[1].font = "italic " + (-(t % 500) / 100 + 30) + "px Krona One";
        ctx[1].fillText(levelinfo[i].artist + " - " + levelinfo[i].songname, w / 2 + 2, h / 10 + i * h / 15 + 2);
        ctx[1].fillStyle = sel !== i ? "#fff" : "#f00";
        ctx[1].fillText(levelinfo[i].artist + " - " + levelinfo[i].songname, w / 2, h / 10 + i * h / 15);
      }
      ctx[1].fillStyle = "#000";
      ctx[1].font = "italic " + (-(t % 500) / 100 + 30) + "px Krona One";
      ctx[1].fillText("Open Editor", w / 2 + 2, h - h / 5 + 2);
      ctx[1].fillStyle = !(sel == 10 || sel == 11) ? "#fff" : "#f00";
      ctx[1].fillText("Open Editor", w / 2, h - h / 5);
      if (inp[" "] || lc == 1) {
        if (sel == 10 || sel == 11) {
          view = "editor";
          Object.keys(editor).forEach(i => {
            let e = document.getElementById(i);
            if (e) e.value = editor[i];
          })
          canv[0].classList.remove("blur2");
          loading = true;
          document.getElementsByTagName("main")[0].classList.add("editor");
          updatebeats(100);
          obstacles = [];
          cdata.aplaying = !!aud.pause();
        } else if (sel >= 0 && sel < levelinfo.length) {
          speed = 1;
          loadlevel(sel);
          reset();
          obstacles = [];
          view = "game";
        }
      } else if (inp["Escape"] == 1) {
        view = "menu";
        reset();
      }
      break;
    case "editor":
      uidiv.style.display = "none";
      creditdiv.style.display = "none";

      loading = false;
      if (!(floor(t / 1000) % 2) || !editdiv.thead.children.length)
        updatebeats(editor.bpm);

      if (inp[" "] == 1) document.querySelector(".play").click();

      ct = aud.currentTime * 1000;
      let curpos = ct / zoom - toff;
      if (curpos > w && !aud.paused) {
        toff += w / 2;
        updatebeats();
      }
      editdiv.tcur.style.left = curpos + "px";
      calcmspb(editor.bpm);

    case "game":
      immortal = no_die || view == "editor";
      if (canv[0].classList.contains("blur2")) canv[0].classList.remove("blur2");
      uidiv.style.display = "none";
      ctx[1].textAlign = "center";
      ctx[1].font = "italic 30px Krona One";
      ctx[1].fillStyle = "#fff";
      if (loading) {
        ctx[1].fillText("Loading...", w / 2, h / 2);
        break;
      }
      if (!cdata.aplaying && view == "game") {
        if (actx.state === 'suspended') {
          actx.resume();
        }
        aud.play();
        cdata.aplaying = true;
      }

      if (debug && lc == 1) aud.currentTime = mpos[0] / w * aud.duration;

      ct = (view == "editor" || debug) ?
        aud.currentTime * 1000 :
        t - levelstarttime - totalpause;
      let lvl = view == "editor" ? editor : levels[clevel];
      let op = 1 - (ct > 5000 ? (ct - 5000) / 2000 : 0);
      op = op < 0 ? 0 : op;
      if (op) {
        ctx.globalAlpha = op;
        ctx[1].fillStyle = "white";
        ctx[1].textAlign = "center";
        ctx[1].font = "italic 30px Krona One";
        ctx[1].fillText(lvl.songname, w / 2, h / 4);
        ctx[1].font = "italic 20px Krona One";
        ctx[1].fillText(lvl.artist, w / 2, h / 3);
      }
      ctx.globalAlpha = 1;
      [...lvl.events, ...cdata.repeatevents].forEach(parseevent);
      lvl.events.forEach(x => { if (x.time > ct) x.triggered = false });

      cdata.cslide.forEach(i => {
        i.prog = (ct - i.starttime) / (i.endtime - i.starttime);
        if (i.data.startsWith("movementcenter"))
          cdata[i.data] = i.start +
            (i.target * (i.data.endsWith("x") ? w : h) - i.start) *
            i.function(i.prog);
        else cdata[i.data] = i.start + (i.target - i.start) * i.function(i.prog);
      })
      cdata.cslide = cdata.cslide.filter(i => i.prog < 1);

      cdata.futurespawns.forEach(i => {
        //console.log(ct, i)
        if (i.time <= ct) {
          obstacles.push(jsontoobj(i.elem));
          i.triggered = true;
        }
      })
      cdata.futurespawns = cdata.futurespawns.filter(i => !i.triggered);

      cdata.indicators.forEach(i => {
        ctx[1].fillStyle = (
          i.type == "warning" ?
            "rgba(255,0,0," :
            "rgba(0,255,0,"
        ) + (1 - (ct - i.start) / i.duration) / 3 + ")";
        ctx[1].fillRect(i.topx, i.topy, i.width, i.height);
      })
      cdata.indicators = cdata.indicators.filter(i => i.start + i.duration > ct);

      a = [cdata.movementcenterx - mpos[0], cdata.movementcentery - mpos[1]];
      // console.log(a);
      // if (a[0]) {
      a = (
        a[1] > 0 ? -atan(abs(a[1]) / abs(a[0])) :
          atan(abs(a[1]) / abs(a[0]))
      );
      if (mpos[0] < cdata.movementcenterx) a = PI - a;
      if (isNaN(a)) a = 0;

      let move = abs((plpos[2] || 0) - a);
      cdata.movement += move;

      plpos = [
        cdata.movementcenterx + cos(a) * cdata.movementradius,
        cdata.movementcentery + sin(a) * cdata.movementradius,
        a
      ]

      prog = aud.currentTime / aud.duration;

      ctx[1].strokeStyle = "#ffffff" + floor(cdata.circleglow * 255).toString(16).padStart(2, "0");
      ctx[1].beginPath()
      ctx[1].arc(
        cdata.movementcenterx,
        cdata.movementcentery,
        cdata.movementradius,
        0, 2 * PI
      );
      ctx[1].stroke();
      ctx[1].fillStyle = "#ffffff" + floor(cdata.circleglow / 3 * 255).toString(16).padStart(2, "0");
      ctx[1].beginPath()
      ctx[1].arc(
        cdata.movementcenterx,
        cdata.movementcentery,
        cdata.movementradius * prog,
        0, 2 * PI
      );
      ctx[1].fill();

      ctx[1].strokeStyle = "#777";
      ctx[1].beginPath();
      ctx[1].moveTo(...mpos);
      ctx[1].lineTo(plpos[0], plpos[1]);
      ctx[1].stroke();

      obstacles.forEach(i => i.draw(cdata.audplaying, true));

      ctx[1].fillStyle = "#fff";
      ctx[1].beginPath();
      ctx[1].arc(
        plpos[0], plpos[1],
        5, 0, 2 * PI
      );
      ctx[1].fill();

      if (debug || view == "editor") {
        ctx[1].textAlign = "left";
        ctx[1].font = "italic 30px Krona One";
        ctx[1].fillText(
          floor(ct / mspb / 4) + "." +
          (floor(ct / mspb) % 4 + 1),
          10, 40
        )
      }

      if (
        view !== "editor" &&
        (inp["Escape"] ||
        (lc == 1 && sqrt((mpos[0] - w / 2) ** 2 + (mpos[1] - h / 2) ** 2) < cdata.movementradius))
      ) {
        view = "pause";
        pausetime = t;
      }
      if (prog == 1 && view == "game") {
        view = "complete";
      }

      break;
    case "pause":
      uidiv.style.display = "block";
      ctx[1].textAlign = "center";
      ctx[1].font = "italic 40px Krona One";
      ctx[1].fillStyle = "#fff";
      ctx[1].fillText("Pause", w / 2, h / 2);
      ctx[1].font = "italic 30px Krona One";
      ctx[1].fillText(
        (mobile ? "Tap" : "Press Space or click") + " to resume",
        w / 2, h / 1.3);
      if (debug) {
        ctx[1].textAlign = "left";
        ctx[1].fillText(
          floor((aud.currentTime * 1000) / mspb / 4) + "." +
          (floor((aud.currentTime * 1000) / mspb) % 4 + 1),
          10, 40
        )
      }
      aud.pause();
      cdata.aplaying = false;
      if (inp[" "] || lc == 1) {
        totalpause += t - pausetime;
        view = "game";
      } else if (inp["Escape"] == 1) {
        view = "menu";
        reset();
      }
      break;
    case "death":
      immortal = true;
      uidiv.style.display = "block";
      obstacles.forEach(i => i.draw(true, true));
      ctx[1].textAlign = "center";
      ctx[1].fillStyle = "#500";
      ctx[1].font = "italic 40px Krona One";
      ctx[1].fillText("You died", w / 2 + 2, h / 2 + 2);
      ctx[1].font = "italic 30px Krona One";
      ctx[1].fillText(
        (mobile ? "Tap" : "Press Space or click") + " to try again",
        w / 2 + 2, h / 1.3 + 2);
      ctx[1].fillStyle = "#faa";
      ctx[1].font = "italic 40px Krona One";
      ctx[1].fillText("You died", w / 2, h / 2);
      ctx[1].font = "italic 30px Krona One";
      ctx[1].fillText(
        (mobile ? "Tap" : "Press Space or click") + " to try again",
        w / 2, h / 1.3);
      // if (!canv[0].classList.contains("blur4")) canv[0].classList.add("blur4");
      deatheff.obj.forEach(e => {
        e.x += sin(e.ang) * e.speed;
        e.y += cos(e.ang) * e.speed;
        e.speed *= 0.985;
        e.rot[0] += e.speed * e.rot[1] / 10;
        // ctx[0].fillText("why", e.x, e.y);
        let op = min(1, e.speed);
        op = max(0, op - .1);
        op = round(op * 255).toString(16).padStart(2, "0");
        // console.log(e,op);
        ctx[1].fillStyle = "#ffffff"// + op;
        ctx[1].beginPath();
        if (e.shape == "circle") {
          ctx[1].moveTo(e.x, e.y);
          ctx[1].arc(e.x, e.y, e.rad, 0, 2 * PI);
        } else if (e.shape == "square") {
          ctx[1].moveTo(e.x + sin(e.rot[0]) * e.rad, e.y + cos(e.rot[0]) * e.rad);
          ctx[1].lineTo(e.x + sin(e.rot[0] + Math.PI / 2) * e.rad, e.y + cos(e.rot[0] + Math.PI / 2) * e.rad);
          ctx[1].lineTo(e.x + sin(e.rot[0] + Math.PI) * e.rad, e.y + cos(e.rot[0] + Math.PI) * e.rad);
          ctx[1].lineTo(e.x + sin(e.rot[0] - Math.PI / 2) * e.rad, e.y + cos(e.rot[0] - Math.PI / 2) * e.rad);
        } else if (e.shape == "triangle") {
          ctx[1].moveTo(e.x + sin(e.rot[0]) * e.rad, e.y + cos(e.rot[0]) * e.rad);
          ctx[1].lineTo(e.x + sin(e.rot[0] + PI / 1.5) * e.rad, e.y + cos(e.rot[0] + PI / 1.5) * e.rad);
          ctx[1].lineTo(e.x + sin(e.rot[0] - PI / 1.5) * e.rad, e.y + cos(e.rot[0] - PI / 1.5) * e.rad);
        }
        ctx[1].fill();
      })
      // deatheff.obj = deatheff.obj.filter(i => i.speed > 0.1);
      cdata.aplaying = false;
      aud.pause();
      if (inp[" "] || lc == 1) {
        view = "game";
        canv[0].classList.remove("blur4");
        speed = 1;
        reset();
      }
      break;
    case "complete":
      uidiv.style.display = "block";
      completetime = t;
      ctx[1].textAlign = "center";
      ctx[1].font = "italic 40px Krona One";
      ctx[1].fillStyle = "#fff";
      ctx[1].fillText("Level complete", w / 2, h / 2);
      ctx[1].font = "italic 30px Krona One";
      ctx[1].fillText(
        (mobile ? "Tap" : "Press Space or click") + " to continue",
        w / 2, h / 1.3);
      if (inp[" "] || lc == 1) view = "credits";
      break;
    case "credits":
      uidiv.style.display = "block";
      creditdiv.style.display = "block";
      if (inp[" "] == 1 || lc == 1) view = "menu";
      break;
  }
  obstacles = obstacles.filter(i => i && !i.deleted);
  lmp = Array.from(mpos);

  if (view !== "editor") {
    ctx[1].strokeStyle = "#777";
    ctx[1].beginPath();
    ctx[1].arc(
      ...mpos,
      5, 0, 2 * PI
    );
    ctx[1].stroke();
  }

  for (i in inp) if (inp[i]) inp[i]++;
  ts = t;
  lc = lc ? lc + 1 : 0;
  rc = rc ? rc + 1 : 0;
  animf = requestAnimationFrame(update);
}
update(0);

function updatesett() {
  const glowobj = document.getElementById("canvglow");
  const volobj = document.getElementById("volume");
  ctx[0].shadowBlur = !glowobj.checked * 10;
  if (!glowobj.checked)
    canv[0].classList.add('glow')
  else
    canv[0].classList.remove('glow');
  gain.gain.value = parseFloat(volobj.value);
  localStorage.setItem("rb-glow", glowobj.checked);
  localStorage.setItem("rb-vol", volobj.value);
}
function readsett() {
  let glowobj = document.getElementById("canvglow");
  let volobj = document.getElementById("volume");
  glowobj.checked = localStorage.getItem("rb-glow") == "true";
  volobj.value = parseFloat(localStorage.getItem("rb-vol"));
  updatesett()
}
readsett()

ctx[0].shadowColor = "#fff";
ctx[0].shadowOffsetX = 0;
ctx[0].shadowOffsety = 0;
ctx[0].shadowBlur = !document.querySelector("#canvglow").checked * 10;
!document.querySelector("#canvglow").checked ?
  canv[0].classList.add('glow') :
  canv[0].classList.remove('glow')

function minput(e) {
  if (e.target.tagName != "CANVAS") return;
  mpos = [e.layerX * ((view == "editor") + 1), e.layerY * ((view == "editor") + 1)];
  lc = (e.buttons & 1) ? 1 : 0;
  rc = (e.buttons & 2) ? 1 : 0;
}
function kinput(e) {
  // console.log(e);
  inp[e.key] = e.type == "keydown" ? 1 : 0;
}

document.body.addEventListener("mousemove", minput);
editdiv.main.addEventListener("mousemove", minput);
document.body.addEventListener("mousedown", minput);
editdiv.main.addEventListener("mousedown", minput);
document.body.addEventListener("mouseup", minput);
editdiv.main.addEventListener("mouseup", minput);
document.body.addEventListener("keydown", kinput);
editdiv.main.addEventListener("keydown", kinput);
document.body.addEventListener("keyup", kinput);
editdiv.main.addEventListener("keyup", kinput);

editdiv.tbody.addEventListener("mousedown", e => tldragstart = e.clientX);
editdiv.tbody.addEventListener("mousemove", e => {
  if (e.buttons & 1) {
    toff -= e.clientX - tldragstart;
    tldragstart = e.clientX;
    if (toff < 0) toff = 0;
    updatebeats();
  }
});