import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Pathfinding, PathfindingHelper } from "three-pathfinding";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { Color, MeshBasicMaterial, Vector3 } from "three";
import { LoadingManager } from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

const scene = new THREE.Scene();
let mainWidth, mainHeight, container;
const renderer = new THREE.WebGLRenderer({
  antialias: true,
});
const toneMappingOptions = {
  None: THREE.NoToneMapping,
  Linear: THREE.LinearToneMapping,
  Reinhard: THREE.ReinhardToneMapping,
  Cineon: THREE.CineonToneMapping,
  ACESFilmic: THREE.ACESFilmicToneMapping,
  Custom: THREE.CustomToneMapping,
};
let numberadder = 3;
// renderer.toneMapping = toneMappingOptions[numberadder];
renderer.toneMappingExposure = 1.25;
const camera = new THREE.PerspectiveCamera();
const controls = new OrbitControls(camera, renderer.domElement);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/gltf/");
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

const agentGroup = new THREE.Group();
let unicornAnimation, run, pause;

// RAYCASTING
const raycaster = new THREE.Raycaster(); // create once
const clickMouse = new THREE.Vector2(); // create once

const tempCrystalLocation = new THREE.Vector3(
  4.414228882961286,
  0.5748497769470511,
  2.474974647790544
);

//ALL
//Append renderer to body, add lighting, TODO create lighting function
sceneSetup();

camSetup();
render();
controlSetup();
window.addEventListener("resize", onWindowResize);
addAgent();
crystalManager();
// treeManager();
cloudManager();
potManager();

let texturesky;

function sceneSetup() {
  mainWidth = window.innerWidth;
  mainHeight = window.innerHeight;
  scene.background = new THREE.Color(0xa8def0);
  container = document.createElement("div");
  document.body.appendChild(container);

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
  scene.add(dLight);

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
  scene.add(dlight2);

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
  scene.add(dlight3);

  // const light = new THREE.AmbientLight(0x404040, 2); // soft white light
  // scene.add(light);
  //SKY MAP

  new THREE.TextureLoader().load("models/sky.jpg", function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.encoding = THREE.sRGBEncoding;
    texturesky = texture;
    scene.background = texture;
    scene.environment = texture;

    pngBackground = texture;
  });
}

function camSetup() {
  camera.fov = 40;
  camera.aspect = mainWidth / mainHeight;
  camera.updateProjectionMatrix();

  // camera.position.set(25, 30, 0);
}
function controlSetup() {
  controls.target.copy(agentGroup.position);
  controls.update();
  controls.enablePan = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.minDistance = 6;
  controls.maxDistance = 20;
  controls.maxPolarAngle = Math.PI / 2 - 0.05; // prevent camera below ground
}

function render() {
  renderer.setSize(mainWidth, mainHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);
}

function onWindowResize() {
  mainWidth = window.innerWidth;
  mainHeight = window.innerHeight;

  camera.aspect = mainWidth / mainHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(mainWidth, mainHeight);
}

let mapAnimation;
let tree;

class Objectq {
  file: string;
  s: number;
  model;
  constructor(file) {
    console.log("COnstructor Loaded");

    this.file = file;
    this.s = 2;
    this.loadModel();
  }

  async loadModel() {
    let parentObject = this;
    loader.load(
      "./models/trees.glb",
      function (gltf) {
        tree = gltf.scene;
        // model.traverse(function (obj) {
        //   obj.frustumCulled = false;
        // });

        scene.add(tree);

        mapAnimation = new THREE.AnimationMixer(tree);

        gltf.animations.forEach((element) => {
          mapAnimation.clipAction(element).play();
        });

        mapLoaded = true;

        gameLoop();
      },
      undefined,
      function (e) {
        console.error(e);
      }
    );
  }
}

let temptree = new Objectq("trees");

function addAgent() {
  loader.load(
    "./models/Unicorn2.glb",

    function (gltf) {
      const model = gltf.scene;
      // model.traverse(function (obj) {
      //   obj.frustumCulled = false;
      // });

      let s = 1;
      model.scale.set(s, s, s);
      agentGroup.add(model);

      unicornAnimation = new THREE.AnimationMixer(model);

      run = unicornAnimation.clipAction(gltf.animations[0]);
      pause = unicornAnimation.clipAction(gltf.animations[2]);

      mapLoaded = true;

      gameLoop();
    },
    undefined,
    function (e) {
      console.error(e);
    }
  );

  agentGroup.position.set(
    0.4525746100407002,
    6.381044395416765,
    -1.6994514628907247
  );

  scene.add(agentGroup);
}

class Crystals {
  static currentGem = "diamond"; // define static variable currentGem
  location: Vector3;
  color: Color;
  visible: Boolean;

  constructor(location, color) {
    this.location = location;
    this.color = color;
    this.visible = true; // set initial value of visible to true
  }

  setVisible(visible) {
    this.visible = visible;
  }
}

let gem;
function crystalManager() {
  loader.load(
    "./models/gem.glb",
    function (gltf) {
      gem = gltf.scene;
      gem.position.copy(tempCrystalLocation);
      gem.position.add(new THREE.Vector3(0, -1, 0));
      gem.scale.set(2, 2, 2);

      gem.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          //@ts-ignore

          //@ts-ignore
          o.material.emissiveIntensity = 10;
          console.log("Gem");
          console.log(o.material);
        }
      });

      scene.add(gem);

      gameLoop();
    },
    undefined,
    function (e) {
      console.error(e);
    }
  );
}

function toggleDivVisibility(color, show) {
  const div = document.getElementById(color);
  if (show) {
    div.style.display = "block";
  } else {
    div.style.display = "none";
  }
}

function treeManager() {
  loader.load(
    "./models/trees.glb",
    function (gltf) {
      tree = gltf.scene;
      // model.traverse(function (obj) {
      //   obj.frustumCulled = false;
      // });

      scene.add(tree);

      mapAnimation = new THREE.AnimationMixer(tree);

      gltf.animations.forEach((element) => {
        mapAnimation.clipAction(element).play();
      });

      mapLoaded = true;

      gameLoop();
    },
    undefined,
    function (e) {
      console.error(e);
    }
  );
}

let clouds;
let cloudsAnimation;
function cloudManager() {
  loader.load(
    "./models/clouds.glb",
    function (gltf) {
      clouds = gltf.scene;
      // model.traverse(function (obj) {
      //   obj.frustumCulled = false;
      // });

      scene.add(clouds);

      cloudsAnimation = new THREE.AnimationMixer(clouds);

      gltf.animations.forEach((element) => {
        cloudsAnimation.clipAction(element).play();
      });

      // mapLoaded = true;

      gameLoop();
    },
    undefined,
    function (e) {
      console.error(e);
    }
  );
}

let pot;
function potManager() {
  loader.load(
    "./models/pot.glb",
    function (gltf) {
      pot = gltf.scene;
      // model.traverse(function (obj) {
      //   obj.frustumCulled = false;
      // });

      scene.add(pot);

      // cloudsAnimation = new THREE.AnimationMixer(clouds);

      // gltf.animations.forEach((element) => {
      //   cloudsAnimation.clipAction(element).play();
      // });

      pot.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          //@ts-ignore

          if ((o as THREE.Mesh).material.name === "pot") {
            //@ts-ignore
            o.material.envMapIntensity = 2;
            o.material.metalness = 1;
            o.material.roughness = 0;
            console.log(o.material);

            //@ts-ignore
          }
        }
      });

      gameLoop();
    },
    undefined,
    function (e) {
      console.error(e);
    }
  );
}
let pngCubeRenderTarget;
let pngBackground;

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// LOAD LEVEL

let mapLoaded = false;
loader.load(
  "./models/Crystalverse.glb",
  function (gltf) {
    const model = gltf.scene;
    // model.position.set(0, -20, 0);
    // model.traverse(function (obj) {
    //   obj.frustumCulled = false;
    // });
    // model.scale.set(0.01, 0.01, 0.01);
    const loader = new THREE.TextureLoader();

    //loading texture
    const texture = loader.load("models/texture.jpg");
    texture.flipY = false;

    scene.add(model);

    // scene.fog = new THREE.Fog(
    //   0x990000,
    //   camera.position.distanceTo(agentGroup.position),
    //   camera.position.distanceTo(agentGroup.position) + 10
    // );

    // initializing material
    let mat = new THREE.MeshBasicMaterial();
    mat.map = texture;
    mat.envMap = texturesky;

    mat.reflectivity = 0.3;
    //@ts-ignore

    // mat.envMapIntensity = 40;

    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        //@ts-ignore

        if ((o as THREE.Mesh).material.name === "map") {
          //@ts-ignore
          o.material = mat;
          //@ts-ignore
        }
      }
    });
    // mapAnimation = new THREE.AnimationMixer(scene);
    // const clips = scene.animations;

    // clips.forEach(function (clip) {
    //   mapAnimation.clipAction(clip).play();
    // });
    // scene.add(model);

    gameLoop();
  },
  undefined,
  function (e) {
    console.error(e);
  }
);

// INITIALIZE THREE-PATHFINDING
const pathfinding = new Pathfinding();
const pathfindinghelper = new PathfindingHelper();
// scene.add(pathfindinghelper);
const ZONE = "level1";
let navmesh;
let groupID;
let navpath;

loader.load("./models/paths.glb", (gltf: GLTF) => {
  // scene.add(gltf.scene);

  gltf.scene.traverse((node) => {
    if (
      !navmesh &&
      node.isObject3D &&
      node.children &&
      node.children.length > 0
    ) {
      navmesh = node.children[0];

      pathfinding.setZoneData(ZONE, Pathfinding.createZone(navmesh.geometry));
    }
  });
});

let curve;
let curveDistance;
var dir = new THREE.Vector3(); // create once an reuse it
let clicked;
loader.load(
  "./models/gemVfx.glb",
  function (gltf) {
    clicked = gltf.scene;
    clicked.position.add(new THREE.Vector3(0, 1, 0));
    // gem.scale.set(2, 2, 2);

    // gem.traverse((o) => {
    //   if ((o as THREE.Mesh).isMesh) {
    //     //@ts-ignore

    //     //@ts-ignore
    //     o.material.emissiveIntensity = 10;
    //     console.log("Gem");
    //     console.log(o.material);
    //   }
    // });

    scene.add(clicked);

    gameLoop();
  },
  undefined,
  function (e) {
    console.error(e);
  }
);

document.addEventListener("click", (event) => {
  numberadder += 1;
  // THREE RAYCASTER
  clickMouse.x = (event.clientX / mainWidth) * 2 - 1;
  clickMouse.y = -(event.clientY / mainHeight) * 2 + 1;
  raycaster.setFromCamera(clickMouse, camera);
  let found = raycaster.intersectObjects(scene.children);
  console.log(found[0]);

  if (found.length > 0) {
    const agentpos = agentGroup.position;

    groupID = pathfinding.getGroup(ZONE, agentGroup.position);
    // find closest node to agent, just in case agent is out of bounds
    let closest = pathfinding.getClosestNode(agentpos, ZONE, groupID);
    let target = pathfinding.getClosestNode(found[0].point, ZONE, groupID);

    navpath = pathfinding.findPath(
      closest.centroid,
      target.centroid,
      ZONE,
      groupID
    );

    // navpath.unshift(agentpos);
    //load in the pointed to model

    dir
      .subVectors(navpath[0], agentpos)
      .normalize()
      .setScalar(0.1)
      .add(agentpos);
    navpath.unshift(dir);

    // navpath.unshift(dir);
    curve = new THREE.CatmullRomCurve3(navpath);

    clicked.position.copy(curve.getPointAt(1));
    clicked.lookAt(curve.getPointAt(1 - 0.005));
    clicked.position.add(new THREE.Vector3(0, 0.1, 0));

    // curveDistance = curve.getLength();
    progress = 0;
    adder = 1 / curve.getLength();

    // navpath = curve.getSpacedPoints(Math.floor(curve.getLength() * 0.5));

    if (navpath) {
      // console.log(`navpath: ${JSON.stringify(navpath)}`);
      pathfindinghelper.reset();
      pathfindinghelper.setPlayerPosition(agentpos);
      pathfindinghelper.setTargetPosition(target);
      pathfindinghelper.setPath(navpath);
    }
  }
});

const geometry = new THREE.BoxGeometry(0.5, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0x001133 });
const cube = new THREE.Mesh(geometry, material);
cube.position.set(0, -3, -5);
// camera.add(cube);
scene.add(camera);

// MOVEMENT ALONG PATH

const followGroup = new THREE.Group();

const SPEED = 4;
let progress,
  adder = 0.1;

function move2(delta: number) {
  if (progress < 1) {
    agentGroup.position.copy(curve.getPointAt(progress));

    let temp = new THREE.Vector3();
    temp.addVectors(agentGroup.position, curve.getTangentAt(progress));
    agentGroup.lookAt(temp);
    // console.log(curve.getTangentAt(progress));
    // console.log(agentGroup.position);
    run.play();
    progress = progress + adder * delta * SPEED;
  } else {
    run.stop();

    if (agentGroup.position.distanceTo(tempCrystalLocation) < 1) {
      toggleDivVisibility("violet", true);
      gem.visible = false;
    }

    //PickUP
    // x: 1.868824390068049;
    // y: 6.369992274544476;
    // z: -1.417684481914042;
  }
}

// GAMELOOP
const clock = new THREE.Clock();

let gameLoop = () => {
  requestAnimationFrame(gameLoop);
  let delta = clock.getDelta();
  move2(delta);
  // console.log(mapLoaded);
  if (mapLoaded) {
    camera.lookAt(agentGroup.position);
    controls.target.copy(agentGroup.position);
    controls.update();

    if (unicornAnimation !== undefined) unicornAnimation.update(delta * 2);
    if (mapAnimation !== undefined) mapAnimation.update(delta * 0.8);
    if (cloudsAnimation !== undefined) cloudsAnimation.update(delta * 0.3);
  }

  renderer.render(scene, camera);
};

// const camera = new THREE.PerspectiveCamera(
//   40,
//   mainWidth / mainHeight,
//   0.1,
//   1000
// );
// camera.position.set(25, 30, 0);

// ORBIT CAMERA CONTROLS
// const orbitControls = new OrbitControls(camera, renderer.domElement);
// orbitControls.mouseButtons = {
//   LEFT: THREE.MOUSE.ROTATE,
//   RIGHT: THREE.MOUSE.PAN,
// };
// orbitControls.enableDamping = true;
// // orbitControls.enablePan = true;
// orbitControls.minDistance = 1;
// orbitControls.maxDistance = 100;
// orbitControls.maxPolarAngle = Math.PI / 2 - 0.05; // prevent camera below ground
// orbitControls.minPolarAngle = Math.PI / 4; // prevent top down view
// orbitControls.update();

// const pmremGenerator = new THREE.PMREMGenerator(renderer);
// scene.environment = pmremGenerator.fromScene(
//   new RoomEnvironment(),
//   0.04
// ).texture;
