import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Pathfinding, PathfindingHelper } from "three-pathfinding";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { MeshBasicMaterial, MeshLambertMaterial } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { GUI } from "dat.gui";

const pathVariable = "";

//2D stuff
// var pathVariable = "https://static1.lenskart.com/media/desktop/img/Apr23/15th-apr/"; // path variable

//function to create screens
function createScreen(screenId, elements, nextScreenId, triggerElementId = null, trigger = true) {
  const screen = document.createElement("div");
  screen.setAttribute("id", screenId);
  // screen.style.display = "flex";
  document.body.appendChild(screen);

  elements.forEach((element) => {
    const newElement = document.createElement(element.type);
    newElement.innerHTML = element.content;

    if (element.id) {
      newElement.setAttribute("id", element.id);
    }

    if (element.className) {
      newElement.setAttribute("class", element.className);
    }

    if (element.src) {
      newElement.setAttribute("src", element.src);
    }

    screen.appendChild(newElement);

    if (element.id === triggerElementId) {
      newElement.addEventListener("click", () => {
        document.getElementById(screenId).style.display = "none";
        document.getElementById(nextScreenId).style.display = "flex";
      });
      //remove self event listener if clicked
    }
  });
}

// PLATFORM
// Phones and tablets play portrait, PCs and laptops play landscape. Screen
// width alone can't tell those apart (a laptop and a landscape tablet are both
// "wide"), so key off the pointer type instead: coarse pointer == touch device.
function isHandheldDevice() {
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

const isHandheld = isHandheldDevice();

// Exposed to CSS so the 2D screens can lay themselves out per platform.
document.documentElement.setAttribute("data-platform", isHandheld ? "handheld" : "desktop");

// Handhelds are portrait-only. Rotating one sideways shows a "rotate" overlay
// rather than rendering the game into a letterbox it was never framed for.
function updateOrientationState() {
  const sideways = isHandheld && window.innerWidth > window.innerHeight;
  document.documentElement.setAttribute("data-orientation", sideways ? "landscape" : "portrait");
}
updateOrientationState();
window.addEventListener("orientationchange", updateOrientationState);

// Built here rather than in index.html so it exists whichever HTML shell loads
// the bundle. CSS keeps it hidden until a handheld is turned sideways.
{
  const rotate = document.createElement("div");
  rotate.setAttribute("id", "rotateDevice");

  const rotateLogo = document.createElement("img");
  rotateLogo.setAttribute("src", pathVariable + "gemUI/logo.png");

  const rotateText = document.createElement("p");
  rotateText.innerHTML = "Turn your device upright to play";

  rotate.appendChild(rotateLogo);
  rotate.appendChild(rotateText);
  document.body.appendChild(rotate);
}

let storyElements = [];

//Splash Screen
{
  storyElements = [
    { type: "img", id: "storyImg1", src: pathVariable + "gemUI/logo.png", className: "storyImage" },
    { type: "p", content: isHandheld ? "Tap to Play" : "Click to Play" },
  ];
  createScreen("splashScreen", storyElements, "story");
  //when spash screen is clicked do something
  document.getElementById("splashScreen").addEventListener("click", () => {
    document.getElementById("splashScreen").style.display = "none";
    document.getElementById("story").style.display = "flex";
    // The way back to the portfolio is offered before play starts and taken
    // away once it has, so it never floats over the game.
    document.getElementById("exit")?.remove();
  });
}

//Story Screen
{
  const texts = [
    "Long ago, when the universe was born, seven magical crystals were born with it.",
    "The seven crystals came together and created a beautiful rainbow that spread magic all across the universe.",
    "The rainbow and the crystals made a very special place called The Crystalverse. It was an island that floated high up in the sky.",
    "The magic of The Crystalverse created four unicorns whose job was to take care of the crystals and guard the rainbow. ",
    "One day, one of them accidentally knocked over the cauldron that held the magical crystals. This caused the crystals to fly all over The Crystalverse.",
    "The unicorns need your help! Can you to put the crystals back where they belong to save the rainbow?",
  ];
  storyElements = [
    { type: "img", id: "storyImg1", src: pathVariable + "gemUI/logo.png", className: "storyImage" },

    { type: "img", id: "storyImg1", src: pathVariable + "gemUI/1.jpg", className: "storyImage" },
    { type: "p", id: "storyText1", content: texts[0] },
    { type: "img", id: "storyImg1", src: pathVariable + "gemUI/2.jpg", className: "storyImage" },
    { type: "p", id: "storyText1", content: texts[1] },
    { type: "img", id: "storyImg1", src: pathVariable + "gemUI/3.jpg", className: "storyImage" },
    { type: "p", id: "storyText1", content: texts[2] },
    { type: "img", id: "storyImg1", src: pathVariable + "gemUI/4.jpg", className: "storyImage" },
    { type: "p", id: "storyText1", content: texts[3] },
    { type: "img", id: "storyImg1", src: pathVariable + "gemUI/5.jpg", className: "storyImage" },
    { type: "p", id: "storyText1", content: texts[4] },
    { type: "img", id: "storyImg1", src: pathVariable + "gemUI/6.jpg", className: "storyImage" },
    { type: "p", id: "storyText1", content: texts[5] },
    { type: "button", id: "storyButton", content: "Play Game" },
  ];

  createScreen("story", storyElements, "unicornSelection", "storyButton");
  document.getElementById("story").style.display = "none";
}

// The unicorn-selection screen is markup in index.html, not built here: the
// story screen's own "Play Game" button already reveals it by id.  This used
// to call createScreen() again with the story's elements, which appended a
// second <div id="unicornSelection"> holding a duplicate copy of the six story
// images — hidden, never shown, but a duplicate id and six more decodes.

//scene
const scene = new THREE.Scene();
let mainWidth, mainHeight, container;
const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

// camera
const camera = new THREE.PerspectiveCamera();
const controls = new OrbitControls(camera, renderer.domElement);
scene.add(camera);

// loaders
const dracoLoader = new DRACOLoader();
// Relative, not "/": the game is deployed under /game/unicorn/ on the
// portfolio, so an absolute path would look for the decoder at the site
// root and every Draco-compressed model would fail to parse.
dracoLoader.setDecoderPath("draco/");
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);
const textureLoader = new THREE.TextureLoader();

//sound
// camera.add(listener);
const audioLoader = new THREE.AudioLoader();
const listener = new THREE.AudioListener();

//bloom
let composer, bloomPass;

// agent group
const agentGroup = new THREE.Group();
let unicornAnimation, run, pause;
let skyTexture;
// raycasting
const raycaster = new THREE.Raycaster(); // create once
const clickMouse = new THREE.Vector2(); // create once

// Locations
const potLocation = new THREE.Vector3(-5.031351626658546, 9.484762908259675, -5.378310006577937);

//animations hello
let loopAnimations = [];

// INDEX
sceneSetup();
camSetup();
lighting();
controlSetup();
window.addEventListener("resize", onWindowResize);

//SOUND fileName Loop? Volume
class sounds {
  static a = [];
  sound = new THREE.Audio(listener);
  //@ts-ignore

  constructor(file, loop = false) {
    let p = this;
    audioLoader.load(pathVariable + "sounds/" + file + ".mp3", function (buffer) {
      p.sound.setBuffer(buffer);
      p.sound.setLoop(loop);
      // p.sound.setVolume(volume);
    });
  }
}

// pick unicorn to load
let picked = "unicorn1";
let unicornNameColors = ["d0ec90", "fff1ce", "ff8538", "c4e9ff"];
const names = ["Jade", "Pearl", "Topaz", "Opal"];
for (let index = 0; index < names.length; index++) {
  const element = names[index];
  let elem = document.createElement("img");
  // elem.innerHTML = names[index];
  elem.src = "video/uni" + (index + 1) + ".jpg";

  let video = document.createElement("video");
  video.src = "video/uni" + (index + 1) + ".mp4";

  video.autoplay = true;
  video.playsInline = true;
  video.controls = false;
  video.muted = true;
  video.loop = true;

  video.style.boxShadow = "0px 0px 100px #" + unicornNameColors[index];

  if (index > 0) {
    video.style.display = "none";
  } else {
    elem.classList.toggle("borderGlow");
  }
  document.getElementById("unicornVideo").appendChild(video);

  elem.addEventListener("click", () => {
    picked = "unicorn" + (index + 1);

    unicornIconClicked(index);
  });
  document.getElementById("unicornIcons").appendChild(elem);
}

function frameDisplay(name, displayType) {
  document.getElementById(name).style.display = displayType;
}

let currentUnicornIcon = 0;
let nameColors = ["rgb(49, 10, 27)", "rgb(16, 23, 51)", "rgb(62, 30, 0)", "rgb(28, 10, 39)"];

function unicornIconClicked(a) {
  // elem.classList.toggle("borderGlow");

  document.getElementById("unicornName").style.animation = "swooshText 400ms ease 1";

  setTimeout(function () {
    document.getElementById("unicornName").style.animation = "";
  }, 400);
  setTimeout(function () {
    document.getElementById("unicornName").innerHTML = names[a];
  }, 100);
  document.getElementById("unicornName").style.color = "#" + unicornNameColors[a];
  document.getElementById("unicornIcons").children[
    currentUnicornIcon
    //@ts-ignore
  ].classList.toggle("borderGlow");
  document.getElementById("unicornIcons").children[
    a
    //@ts-ignore
  ].classList.toggle("borderGlow");

  document.getElementById("unicornVideo").children[
    a
    //@ts-ignore
  ].currentTime =
    document.getElementById("unicornVideo").children[
      currentUnicornIcon
      //@ts-ignore
    ].currentTime;

  // document.getElementById("unicornSelection").style.backgroundColor = nameColors[a];

  document.getElementById("unicornVideo").children[
    currentUnicornIcon
    //@ts-ignore
  ].style.display = "none";
  //@ts-ignore
  document.getElementById("unicornVideo").children[a].style.display = "block";
  currentUnicornIcon = a;
}
let elem = document.createElement("button");
elem.innerHTML = "Start Game";
document.getElementById("unicornSelection").appendChild(elem);
elem.addEventListener("click", () => {
  addAgent(picked);
  bgMusic.sound.play();
  document.getElementById("unicornSelection").style.display = "none";
  document.getElementById("three").style.display = "flex";
  document.getElementById("mute").style.display = "block";
  document.getElementById("crystals").style.display = "block";
  document.getElementById("instructions").style.display = "flex";
  document.getElementById("tapMove").style.display = "flex";
  document.getElementById("instructionText").innerHTML = isHandheld ? "Tap to Move" : "Click to Move";
});

// const buttons = document.getElementById("gifContainer").children;

// const buttonPressed = (e) => {
// 	console.log(e.target.id); // Get ID of Clicked Element
// 	addAgent(e.target.id);
// 	document.getElementById("overlay").style.display = "none";
// 	document.getElementById("three").style.display = "flex";
// 	document.getElementById("crystals").style.display = "block";
// };
// //@ts-ignore
// for (let button of buttons) {
// 	button.addEventListener("click", buttonPressed);
// 	button.addEventListener("touchstart", buttonPressed);
// }

// adding sounds

let agent = new sounds("run", true);
let bgMusic = new sounds("bg", true);
let gemPickup = new sounds("gem-pickup", false);
let gemDrop = new sounds("gem-drop", false);
//hello
let collectedAnimations = [];
let rainbowGroup = new THREE.Group();

//play and pause icon
let mute = false;
document.getElementById("sound").addEventListener("click", () => {
  mute = !mute;
  if (mute) {
    listener.setMasterVolume(0);
    //@ts-ignore

    document.getElementById("sound").src = "gemUI/soundOff.svg";
  } else {
    listener.setMasterVolume(1);
    //@ts-ignore

    document.getElementById("sound").src = "gemUI/soundOn.svg";
  }
});

//navigating the slides

//class to add an object
class prop {
  file: string;
  s: number;
  model: THREE.Object3D;
  animation: THREE.AnimationMixer;
  play: boolean;
  passedFunction: Function;

  constructor(file, playAnimation = false, passedFunction = () => {}) {
    this.file = file;
    this.s = 2;
    this.play = playAnimation;
    this.loadModel();
    this.passedFunction = passedFunction;
  }

  loadModel() {
    let p = this;
    loader.load(
      pathVariable + "./models/" + this.file + ".glb",
      function (gltf) {
        if (gltf.scene.children.length == 1) {
          p.model = gltf.scene.children[0];
        } else {
          p.model = gltf.scene;
        }

        if (p.play) {
          p.animation = new THREE.AnimationMixer(gltf.scene);
          gltf.animations.forEach((element) => {
            p.animation.clipAction(element).play();
          });
        }

        p.passedFunction(gltf);

        scene.add(gltf.scene);

        // mapAnimation = new THREE.AnimationMixer(tree);

        // gltf.animations.forEach((element) => {
        //   mapAnimation.clipAction(element).play();
        // });

        mapLoaded = true;

        startGameLoop();
      },
      undefined,
      function (e) {
        console.error(e);
      }
    );
  }
}

//load all
async function loadModels() {
  let m = new MeshBasicMaterial();

  const [clouds, reflectionMap] = await Promise.all([loader.loadAsync("models/clouds.glb"), textureLoader.loadAsync("models/envMap.jpg")]);

  //load in the environment map
  reflectionMap.mapping = THREE.EquirectangularReflectionMapping;
  reflectionMap.encoding = THREE.sRGBEncoding;
  skyTexture = reflectionMap;

  //CLOUDS
  m.color.setHex(0xcccccc);
  m.envMap = reflectionMap;
  m.reflectivity = 0.7;
  clouds.scene.traverse((o) => {
    //@ts-ignore
    if (o.isMesh) {
      //@ts-ignore
      o.material = m;
    }
  });

  //clouds animation
  let animation = new THREE.AnimationMixer(clouds.scene);
  clouds.animations.forEach((element) => {
    animation.clipAction(element).play();
  });
  loopAnimations.push(animation);

  //clouds add
  scene.add(clouds.scene);
}
loadModels();

let rainbowAnimation = [];

//load and add GEM NEW
const gem = {
  locations: [],
  htmlColors: ["violet", "indigo", "blue", "green", "yellow", "orange", "red"],
  hexColors: [],
  level: 0,
  withUnicorn: false,
  withPot: false,
  group: new THREE.Group(),

  async setup() {
    this.setLocations();
    this.setColors();

    //@ts-ignore
    gem.obj = await loader.loadAsync("models/gem.glb");
    //@ts-ignore
    gem.vfx = await loader.loadAsync("models/animated.glb");
    //@ts-ignore

    let animation = new THREE.AnimationMixer(gem.obj.scene);

    gem.group.add(this.obj.scene);
    gem.group.add(this.vfx.scene);
    //@ts-ignore

    gem.obj.animations.forEach((element) => {
      animation.clipAction(element).play();
    });
    loopAnimations.push(animation);
    //@ts-ignore

    let animationVfx = new THREE.AnimationMixer(gem.vfx.scene);
    let s = 0.7;
    //@ts-ignore
    this.vfx.scene.scale.set(s, s, s);
    this.vfx.scene.position.set(0, 0.7, 0);
    //@ts-ignore
    this.vfx.scene.children[0].material.emissiveIntensity = 20;

    this.vfx.animations.forEach((element) => {
      animationVfx.clipAction(element).play();
    });
    loopAnimations.push(animationVfx);

    this.obj.scene.children[1].material.emissiveIntensity = 100;
    // this.obj.scene.children[0].material.emissiveIntensity = 300;
    // this.obj.scene.children[0].material.color.setHex(
    // 	this.hexColors[this.level]
    // );
    this.obj.scene.children[1].material.emissive.setHex(this.hexColors[this.level]);

    scene.add(this.group);
    this.group.visible = false;

    // gem.setPosition();

    for (let index = 0; index < this.htmlColors.length; index++) {
      let mod = await loader.loadAsync("models/rainbow/" + this.htmlColors[index] + ".glb");

      let animationMixer = new THREE.AnimationMixer(mod.scene);
      let animation = animationMixer.clipAction(mod.animations[0]);
      animation.setLoop(THREE.LoopOnce, 1);
      animation.clampWhenFinished = true;
      animation.enabled = true;
      rainbowAnimation.push(animation);

      collectedAnimations.push(animationMixer);
      mod.scene.visible = false;
      //@ts-ignore

      rainbowGroup.add(mod.scene);
    }

    scene.add(rainbowGroup);

    this.group.position.copy(this.locations[this.level]);
  },

  setLocations() {
    this.addLocation(-5.954112122182721, 3.235512396996011, 2.968936188012168);
    this.addLocation(5.430592065347731, 4.663545958399524, 5.161016513764324);
    this.addLocation(-3.9052576397047103, 3.2801367347367325, 3.2382212116073745);
    this.addLocation(-8.966745125916916, -0.877165771688599, -4.046093939761729);
    this.addLocation(-5.740734107790065, -1.1840626794974227, 6.417189486019682);
    this.addLocation(-2.143413457334942, -0.5486276490857769, -10.91056275573619);
    this.addLocation(7.328487668750352, -0.8422248713303375, -7.8236114149325395);
  },

  addLocation(x, y, z) {
    this.locations.push(new THREE.Vector3(x, y, z));
  },

  setColors() {
    this.hexColors.push(0xee82ee);
    this.hexColors.push(0x4b0082);
    this.hexColors.push(0x0000ff);
    this.hexColors.push(0x008000);
    this.hexColors.push(0xffff00);
    this.hexColors.push(0xffa500);
    this.hexColors.push(0xff0000);
  },

  collected,
  deposited,
};

let lookAtPot = false;

// gem is collected
function collected() {
  if (!this.withUnicorn) {
    this.withUnicorn = true;
    gemPickup.sound.play();
    this.group.visible = false;
    this.group.position.copy(this.locations[this.level]);
    if (this.level == 0) {
      lookAtPot = true;
    }
  }

  if (this.level < 7) {
    toggleDivVisibility(this.htmlColors[this.level], true);
  }
  document.getElementById("instructionText").innerHTML = "Return Gem to Magic Pot";
}

// gem is deposited
function deposited() {
  if (this.withUnicorn) {
    this.withUnicorn = false;

    rainbowGroup.children[this.level].visible = true;
    rainbowAnimation[this.level].play();

    //crystal is deposited move to the next level
    //set up gem postion and material for the next level

    if (this.level < 6) {
      this.level += 1;
      this.obj.scene.children[0].material.color.setHex(this.hexColors[this.level]);

      this.group.position.copy(this.locations[this.level]);
      gemDrop.sound.play();
      this.group.visible = true;
      document.getElementById("instructionText").innerHTML = "Find the Gem";
    } else {
      document.getElementById("endScreen").style.display = "flex";
      document.getElementById("instructions").style.display = "none";
      document.getElementById("crystals").style.display = "none";

      document.getElementById("endScreen").style.display = "flex";
      document.getElementById("endScreenButton").addEventListener("click", () => {
        location.reload();
      });
    }
  }
}

//initialize gem
gem.setup();

//load and add TREES with custom material change and add animation
//@ts-ignore
let tree = new prop("trees", true, (obj) => {
  obj.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      let m = new MeshBasicMaterial();
      m.color = o.material.color;
      m.envMap = skyTexture;

      o.material = m;
    }
  });
});

//load and add environment CRYSTALS with material change
//@ts-ignore
let crystalEnvironment = new prop("crystals", true, (obj) => {
  obj.scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      let m = new MeshLambertMaterial();
      m.color = o.material.color;
      // m.color.setHex(0xff0000);
      m.emissive.setHex(0xffffff);
      m.emissiveMap = o.material.emissiveMap;
      // m.envMap = skyTexture;
      // m.reflectivity = 1;
      //@ts-ignore
      m.transparent = true;
      m.opacity = 0.5;
      m.emissiveIntensity = 4;

      o.material = m;
    }
  });
});

//add the pot
//@ts-ignore

let potold = new prop("pot", true, (obj) => {});
//scale down potold

//add the agent
let agentLoaded = false;
function addAgent(name) {
  loader.load(
    pathVariable + "./models/" + name + ".glb",

    function (gltf) {
      const model = gltf.scene;

      let s = 1;
      model.scale.set(s, s, s);
      agentGroup.add(model);

      unicornAnimation = new THREE.AnimationMixer(model);

      model.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          let m = new MeshBasicMaterial();
          //@ts-ignore
          m.color = o.material.color;
          m.envMap = skyTexture;
          m.reflectivity = 0.3;
          //@ts-ignore
          m.map = o.material.map;
          //@ts-ignore

          o.material = m;
        }
      });

      run = unicornAnimation.clipAction(gltf.animations[0]);
      pause = unicornAnimation.clipAction(gltf.animations[1]);

      agentLoaded = true;
      startGameLoop();
    },
    undefined,
    function (e) {
      console.error(e);
    }
  );

  agentGroup.position.set(0.4525746100407002, 6.381044395416765, -1.6994514628907247);

  scene.add(agentGroup);
}

let pot;

//add the map
let mapLoaded = false;
loader.load(
  pathVariable + "./models/crystalverse.glb",
  function (gltf) {
    const model = gltf.scene;

    //@ts-ignore
    let material = new MeshBasicMaterial();
    //@ts-ignore
    let materialRocks = new MeshBasicMaterial();
    //@ts-ignore
    materialRocks.envMap = skyTexture;
    materialRocks.color.setHex(0xf482a0);

    //@ts-ignore
    material.map = gltf.scene.children[0].material.map;
    //@ts-ignore

    gltf.scene.children[0].material = material;
    //@ts-ignore

    gltf.scene.children[1].material = materialRocks;

    scene.add(model);
  },
  undefined,
  function (e) {
    console.error(e);
  }
);

// INITIALIZE THREE-PATHFINDING
const pathfinding = new Pathfinding();
const ZONE = "level1";
let navmesh;
let groupID;
let navpath;

loader.load(pathVariable + "./models/paths.glb", (gltf: GLTF) => {
  gltf.scene.traverse((node) => {
    if (!navmesh && node.isObject3D && node.children && node.children.length > 0) {
      navmesh = node.children[0];

      pathfinding.setZoneData(ZONE, Pathfinding.createZone(navmesh.geometry));
    }
  });
});

let curve;
let curveDistance;
var dir = new THREE.Vector3(); // create once an reuse it
let clicked = new prop("gemVfx", true);

//@ts-ignore

// loader.load(pathVariable+
// 	"./models/animated.glb",
// 	function (gltf) {
// 		clicked = gltf.scene;
// 		clicked.position.add(new THREE.Vector3(0, 1, 0));
// 		// gem.scale.set(2, 2, 2);

// 		// gem.traverse((o) => {
// 		//   if ((o as THREE.Mesh).isMesh) {
// 		//     //@ts-ignore

// 		//     //@ts-ignore
// 		//     o.material.emissiveIntensity = 10;

// 		//   }
// 		// });

// 		scene.add(clicked);

// 		gameLoop();
// 	},
// 	undefined,
// 	function (e) {
// 		console.error(e);
// 	}
// );

let tapMoved = false;

// function executed after click
document.getElementById("three").addEventListener("click", (event) => {
  // THREE RAYCASTER

  // Map the click into the canvas's own coordinate space rather than the
  // window's. These agree only while the canvas fills the viewport from the
  // origin; measuring the canvas keeps picking correct at any size or offset.
  const canvasRect = renderer.domElement.getBoundingClientRect();
  clickMouse.x = ((event.clientX - canvasRect.left) / canvasRect.width) * 2 - 1;
  clickMouse.y = -((event.clientY - canvasRect.top) / canvasRect.height) * 2 + 1;
  raycaster.setFromCamera(clickMouse, camera);
  let found = raycaster.intersectObject(scene.getObjectByName("map"));
  //@ts-ignore
  // navigator.clipboard.writeText(
  //   found[0].point.x + "," + found[0].point.y + "," + found[0].point.z
  // );

  if (found.length > 0) {
    if (!tapMoved) {
      tapMoved = true;
      frameDisplay("tapMove", "none");
      frameDisplay("pinchZoom", "block");
      document.getElementById("instructionText").innerHTML = isHandheld ? "Pinch to Zoom" : "Scroll to Zoom";
      controls.enabled = true;
      controls.enableZoom = true;
      controls.enableRotate = false;
    }

    const agentpos = agentGroup.position;

    groupID = pathfinding.getGroup(ZONE, agentGroup.position);
    // find closest node to agent, just in case agent is out of bounds
    let closest = pathfinding.getClosestNode(agentpos, ZONE, groupID);
    let target = pathfinding.getClosestNode(found[0].point, ZONE, groupID);

    navpath = pathfinding.findPath(closest.centroid, target.centroid, ZONE, groupID);

    // navpath.unshift(agentpos);
    //load in the pointed to model

    dir.subVectors(navpath[0], agentpos).normalize().setScalar(0.1).add(agentpos);
    navpath.unshift(dir);

    // navpath.unshift(dir);
    curve = new THREE.CatmullRomCurve3(navpath);

    clicked.model.position.copy(curve.getPointAt(1));

    clicked.model.lookAt(curve.getPointAt(1 - 0.005));
    // clicked.model.position.add(new THREE.Vector3(0, 0.1, 0));

    // curveDistance = curve.getLength();
    progress = 0;
    adder = 1 / curve.getLength();

    // navpath = curve.getSpacedPoints(Math.floor(curve.getLength() * 0.5));
  }
});

// MOVEMENT ALONG PATH

const SPEED = 4;
let progress,
  adder = 0.1;
let temp = new THREE.Vector3();

// move agent along curve
function move(delta: number) {
  //if agent is moving

  if (progress < 1) {
    //place and orient agent
    agentGroup.position.copy(curve.getPointAt(progress));
    temp.addVectors(agentGroup.position, curve.getTangentAt(progress));
    agentGroup.lookAt(temp);

    //running animation, sound
    run.play();
    if (!agent.sound.isPlaying) {
      agent.sound.play();
    }

    progress = progress + adder * delta * SPEED;
  } else {
    //if agent has stopped
    run.stop();
    if (agent.sound.isPlaying) {
      agent.sound.pause();
    }

    if (agentGroup.position.distanceTo(gem.locations[gem.level]) < 1.2) {
      gem.collected();
    } else if (agentGroup.position.distanceTo(potLocation) < 2) {
      gem.deposited();
    }
  }
}
controls.enabled = false;
// GAMELOOP update animation and character movement
const clock = new THREE.Clock();

let originalCameraPositoion = new THREE.Vector3().copy(camera.position).sub(controls.target).normalize();

let tapDragged = false;
let pinchZoomed = false;
let gemShown = false;
// Onboarding: zoom the camera, then orbit it, and only then is the gem revealed.
// This used to listen for touchend only, so on a mouse-driven machine the
// sequence could never advance past "Pinch to Zoom" and gem.group was never made
// visible. Wheel and pointerup are the desktop equivalents of the same gestures.
const threeElement = document.getElementById("three");

function advanceTutorial() {
  if (Math.abs(initCamDistance - controls.getDistance()) > 10 && !pinchZoomed) {
    frameDisplay("pinchZoom", "none");
    frameDisplay("tapDrag", "block");
    document.getElementById("instructionText").innerText = isHandheld ? "Touch and Drag to Orbit" : "Drag to Orbit";
    controls.enableRotate = true;
    pinchZoomed = true;
  } else if (new THREE.Vector3().copy(camera.position).sub(controls.target).normalize().distanceTo(originalCameraPositoion) > 0.2 && !tapDragged) {
    frameDisplay("tapDrag", "none");
    document.getElementById("instructionText").innerText = "Find the Gem";
    tapDragged = true;
    threeElement.removeEventListener("touchend", advanceTutorial);
    threeElement.removeEventListener("pointerup", advanceTutorial);
    threeElement.removeEventListener("wheel", advanceTutorial);
    gem.group.visible = true;
  }
}

threeElement.addEventListener("touchend", advanceTutorial, false);
threeElement.addEventListener("pointerup", advanceTutorial, false);
threeElement.addEventListener("wheel", advanceTutorial, { passive: true });

// CAMERA FOLLOW
// The orbit target used to be hard-snapped onto the agent root every frame, so
// every step the unicorn took was handed to the camera raw. Easing the target
// toward the agent instead lets the camera trail it and absorb that motion.
//
// Higher = tighter follow. Around 4-6 keeps the unicorn comfortably centred
// while still smoothing out the per-step motion; drop it for a looser, more
// cinematic trail.
const CAMERA_FOLLOW_SMOOTHING = 5;

// A big frame hitch (asset decode, GC) would otherwise let the agent jump a long
// way in a single step, which reads as a jolt no amount of smoothing can hide.
const MAX_FRAME_DELTA = 1 / 20;

const cameraTarget = new THREE.Vector3();
let cameraTargetReady = false;

function updateCameraFollow(delta: number) {
  if (!cameraTargetReady) {
    // Start pinned, so the first frame doesn't ease in from the world origin.
    cameraTarget.copy(agentGroup.position);
    cameraTargetReady = true;
  }

  // Exponential smoothing, framed so the rate is the same at 30fps and 144fps.
  cameraTarget.lerp(agentGroup.position, 1 - Math.exp(-CAMERA_FOLLOW_SMOOTHING * delta));
  controls.target.copy(cameraTarget);
}

let gameLoop = () => {
  if (agentLoaded) {
    requestAnimationFrame(gameLoop);
    let delta = Math.min(clock.getDelta(), MAX_FRAME_DELTA);

    // Advance the agent BEFORE aiming the camera. The old order updated the
    // controls first, so the camera spent every frame pointed at where the
    // unicorn had been on the previous one and then snapped to catch up.
    move(delta);
    updateCameraFollow(delta);

    // camera.lookAt() used to sit here, but controls.update() re-aims the camera
    // at controls.target anyway, so it was overwritten immediately.
    controls.update();

    if (tapDragged) {
      camera.position.lerp(new THREE.Vector3(-17.327911381137373, 7.393880506337105, 10.181582278355659), 0.05);
      setTimeout(() => {
        tapDragged = false;
      }, 3000);
    }

    if (lookAtPot) {
      camera.position.lerp(new THREE.Vector3(-5.728270173380442, 18.86921734650022, -12.775385101192242), 0.05);
      setTimeout(() => {
        lookAtPot = false;
      }, 3000);
    }

    // bloomPass.strength = (1 + Math.sin(clock.elapsedTime)) * 0.2;
    // camera.position.y = 10 + (1 + Math.sin(clock.elapsedTime * 0.5)) * 2;

    if (true) {
      if (unicornAnimation !== undefined) unicornAnimation.update(delta * 2.2);
      if (tree.animation !== undefined) tree.animation.update(delta);
      if (clicked.animation !== undefined) clicked.animation.update(delta);
      loopAnimations.forEach((element) => {
        element.update(delta);
      });
      collectedAnimations.forEach((element) => {
        element.update(delta);
      });

      // if (rainbow.animation !== undefined) rainbow.animation.update(delta);
      if (potold.animation !== undefined) potold.animation.update(delta);
      // if (r2.animation !== undefined) r2.animation.update(delta);
    }

    // renderer.render(scene, camera);

    composer.render();
  }
};

// Idempotent entry point. gameLoop() is kicked off from the agent loader and
// from every prop loader, so a prop that finishes after the agent would start a
// second requestAnimationFrame chain and render the scene twice per frame.
let gameLoopRunning = false;

function startGameLoop() {
  if (gameLoopRunning || !agentLoaded) return;
  gameLoopRunning = true;
  gameLoop();
}

// function animate() {
//   requestAnimationFrame(animate);

//   composer.render();
//    composer.render();
// }

// RENDER FUNCTION

function onWindowResize() {
  mainWidth = window.innerWidth;
  mainHeight = window.innerHeight;
  camera.aspect = mainWidth / mainHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(mainWidth, mainHeight);

  // The composer and bloom pass own render targets sized independently of the
  // renderer. Without resizing them too, the post-processed image keeps the old
  // resolution and smears after a window resize or a device rotation.
  if (composer) composer.setSize(mainWidth, mainHeight);
  if (bloomPass) bloomPass.setSize(mainWidth, mainHeight);

  updateOrientationState();
}

function sceneSetup() {
  mainWidth = window.innerWidth;
  mainHeight = window.innerHeight;

  renderer.setSize(mainWidth, mainHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputEncoding = THREE.sRGBEncoding;
  container = document.createElement("div");
  container.setAttribute("id", "three");
  container.appendChild(renderer.domElement);
  document.body.appendChild(container);

  //bloom variables
  const renderScene = new RenderPass(scene, camera);
  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);

  const params = {
    exposure: 0.1,
    bloomStrength: 1,
    bloomThreshold: 0.69,
    bloomRadius: 0.8,
  };
  bloomPass.threshold = params.bloomThreshold;
  bloomPass.strength = params.bloomStrength;
  bloomPass.radius = params.bloomRadius;
  bloomPass.exposure = params.exposure;

  composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);
}

// const gui = new GUI();
// const cubeFolder = gui.addFolder("Cube");
// cubeFolder.add(bloomPass, "threshold", 0, 2);
// cubeFolder.add(bloomPass, "strength", 0, 2);
// cubeFolder.add(bloomPass, "radius", 0, 2);

function lighting() {
  //LIGHTING
  const dLight = new THREE.DirectionalLight("white", 1);
  dLight.position.x = 30;
  dLight.position.z = 30;
  dLight.position.y = 60;
  dLight.castShadow = true;
  dLight.shadow.mapSize.width = 1024;
  dLight.shadow.mapSize.height = 1024;
  const d = 35;
  dLight.shadow.camera.left = -d;
  dLight.shadow.camera.right = d;
  dLight.shadow.camera.top = d;
  dLight.shadow.camera.bottom = -d;
  // scene.add(dLight);

  const dlight2 = new THREE.DirectionalLight("white", 1);
  dlight2.position.x = -30;
  dlight2.position.z = -30;
  dlight2.position.y = 60;
  dlight2.castShadow = true;
  dlight2.shadow.mapSize.width = 1024;
  dlight2.shadow.mapSize.height = 1024;
  dlight2.shadow.camera.left = -d;
  dlight2.shadow.camera.right = d;
  dlight2.shadow.camera.top = d;
  dlight2.shadow.camera.bottom = -d;
  // scene.add(dlight2);

  const dlight3 = new THREE.DirectionalLight("white", 1);
  dlight3.position.x = -85;
  dlight3.position.y = 60;
  dlight3.castShadow = true;
  dlight3.shadow.mapSize.width = 1024;
  dlight3.shadow.mapSize.height = 1024;
  dlight3.shadow.camera.left = -d;
  dlight3.shadow.camera.right = d;
  dlight3.shadow.camera.top = d;
  dlight3.shadow.camera.bottom = -d;
  // scene.add(dlight3);

  textureLoader.load(pathVariable + "models/sky.jpg", function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.encoding = THREE.sRGBEncoding;
    scene.background = texture;
    scene.environment = texture;
  });
}

function camSetup() {
  camera.fov = 40;
  camera.aspect = mainWidth / mainHeight;
  camera.updateProjectionMatrix();

  camera.position.set(25, 30, 0);
}

const initCamDistance = controls.getDistance();

function controlSetup() {
  // controls.target.copy(agentGroup.position);
  controls.update();
  controls.enablePan = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 6;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI / 2 - 0.05; // prevent camera below ground
}

function toggleDivVisibility(color, show) {
  const div = document.getElementById(color);
  if (show) {
    div.style.display = "block";
  } else {
    div.style.display = "none";
  }
}
