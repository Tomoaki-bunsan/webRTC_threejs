var wsUri = 'http://localhost:1242';
var socketio = io(wsUri,{ transports: [ 'websocket' ] });
var beat;
socketio.on('beats', (DeviceID, ComputedHeartRate) => {
    console.log(DeviceID, ComputedHeartRate);
    if(id == DeviceID) updateData(ComputedHeartRate);
    else if(!id) updateData(ComputedHeartRate);
    beat = ComputedHeartRate; 
});

let updateData = (beat) => {
    lastBeat = beat;
    //document.querySelector('#textArea').textContent = beat;
}

let getParam = (name, url) => {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    let regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
    let results = regex.exec(url);
    if(!results) return null;
    if(!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}


let chart, beatMotionLoop, lastBeat;
let id = getParam('id') || 0;

function initData(){
  const width = 160;
  const height = 120;
  const Drenderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#dataCanvas')
  });
  // レンダラーを作成
  Drenderer.setPixelRatio(window.devicePixelRatio);
  Drenderer.setSize(width, height);
  // シーンを作成
  const Dscene = new THREE.Scene();

  // カメラを作成
  const Dcamera = new THREE.PerspectiveCamera(90, width / height);
  Dcamera.position.set(0, 0, 300);

  // Load GLTF or GLB
  const loader = new THREE.GLTFLoader();
  const url = './assets/test.glb';
  let model = null;
    loader.load(
        url,
        function (gltf) {
            model = gltf.scene;
            model.scale.set(100.0, 100.0, 100.0);
            model.position.set(0, 0, 0);
            //回転の調整
            //model.rotation.y = THREE.Math.DEG2RAD * -45;
            scene.add(model);
        },
        function (error) {
            console.log('An error happened');
        }
    );
  
  var length = 0.05*100;
  /*const geometry = new THREE.CubeGeometry(100, 100, 100);
  const material = new THREE.MeshBasicMaterial({color:0xFF0000});
  const cube = new THREE.Mesh(geometry, material);
  Dscene.add(cube);*/

  const ambient = new THREE.AmbientLight(0xf8f8ff, 0.9);
  Dscene.add(ambient);

  tick();

  function tick() {
    if (model) {
      if(model.scale.x > 2 || model.scale.x < 0.5) {
        length = -length;
      }
      model.scale.x += 0.02*length;
      model.scale.y += 0.02*length;
      model.scale.z += 0.02*length;
      model.rotation.z += 0.2;
      if(beat<90){
        model.material.color.setHex( 0xffffff );
      }
    }
    Drenderer.render(Dscene, Dcamera); // レンダリング
    console.log("length=",length)
    console.log("cube.scale.x=",model.scale.x)
    requestAnimationFrame(tick);
  }
}

function setupScene(vrm_parent, avatar_name) {  //シーンを設定
  window.renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#myCanvas'),
    antialias: true,
    alpha: true,
    logarithmicDepthBuffer: true
  });
  renderer.setClearColor(new THREE.Color(), 0);
  renderer.setSize(640, 360);
  renderer.setPixelRatio(window.devicePixelRatio);
  vrm_parent.appendChild(renderer.domElement);
  window.camera = new THREE.PerspectiveCamera(90.0, 4.0 / 3.0, 0.1, 5.0); //カメラの初期化
  //50.0, 4.0 / 3.0, 0.1, 5.0
  window.scene = new THREE.Scene();

  

  
  scene.add(new THREE.DirectionalLight(0xffffff)); //光源

  new THREE.GLTFLoader().load(
    `${avatar_name}`, //選択したavatarで生成
    initVRM,
    progress => console.log("Loading model...", 100.0 * (progress.loaded / progress.total), "%"),
    console.error
  );

  
}

async function initVRM(gltf) {
  window.vrm = await THREE.VRM.from(gltf);
  scene.add(vrm.scene);
  vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.Hips).rotation.y = Math.PI;
  vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.LeftUpperArm).rotation.z = Math.PI * 2 / 5;
  vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.RightUpperArm).rotation.z = -Math.PI * 2 / 5;
  const head = vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.Head);
  camera.position.set(0.0, head.getWorldPosition(new THREE.Vector3()).y + 0.05 , 0.5); //(0.0, 1.5, 0.5)ぐらい

  
  
  window.clock = new THREE.Clock();
  clock.start();
  renderer.render(scene, camera);
}

async function setupCamera(videoElement) {  //カメラを用意
  const constraints = { video: { width: 640, height: 360 }, audio: true }; 
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  let myaudio = stream.getAudioTracks()[0];  //カメラから音声を抜き取る
  videoElement.srcObject = stream;
  const canvas2 = document.getElementById("myCanvas");
  var avatarcamera = canvas2.captureStream(60);
  avatarcamera.addTrack(myaudio);  //avatar画面に音声を追加
  
  // 着信時に相手にカメラ映像を返せるように、グローバル変数に保存しておく
  localStream = avatarcamera;
  return new Promise(resolve => {
    videoElement.onloadedmetadata = () => {
      videoElement.play();
      resolve();
    };
  });
}

function estimatePose(annotations) {  //顔の角度の計算
  const faces = annotations.silhouette;
  const x1 = new THREE.Vector3().fromArray(faces[9]);
  const x2 = new THREE.Vector3().fromArray(faces[27]);
  const y1 = new THREE.Vector3().fromArray(faces[18]);
  const y2 = new THREE.Vector3().fromArray(faces[0]);
  const xaxis = x2.sub(x1).normalize();
  const yaxis = y2.sub(y1).normalize();
  const zaxis = new THREE.Vector3().crossVectors(xaxis, yaxis);
  const mat = new THREE.Matrix4().makeBasis(xaxis, yaxis, zaxis).premultiply(
    new THREE.Matrix4().makeRotationZ(Math.PI)
  );
  return new THREE.Quaternion().setFromRotationMatrix(mat);
}

var angleRad = 0;
var scaling = 0;

function startRender(input, output, model) {
  const ctx = output.getContext("2d");
  async function renderFrame() {
    requestAnimationFrame(renderFrame);

    //manipulator.update();
    vrm.update(clock.getDelta());
    const faces = await model.estimateFaces(input, false, false);
    ctx.clearRect(0, 0, output.width, output.height);
    faces.forEach(face => {
      face.scaledMesh.forEach(xy => {
        ctx.beginPath();
        ctx.arc(xy[0], xy[1], 1, 0, 2 * Math.PI);
        ctx.fill();
      });
      const annotations = face.annotations;
      const q = estimatePose(annotations);
      const head = vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.Head);
      head.quaternion.slerp(q, 0.1);
      const blink = Math.max(0.0, 1.0 - 10.0 * Math.abs((clock.getElapsedTime() % 4.0) - 2.0));
      vrm.blendShapeProxy.setValue(THREE.VRMSchema.BlendShapePresetName.Blink, blink);
      const lipsLowerInner = annotations.lipsLowerInner[5];
      const lipsUpperInner = annotations.lipsUpperInner[5];
      const expressionA = Math.max(0, Math.min(1, (lipsLowerInner[1] - lipsUpperInner[1]) / 10.0));
      vrm.blendShapeProxy.setValue(THREE.VRMSchema.BlendShapePresetName.A, expressionA);
    });
    renderer.render(scene, camera);
  }
  renderFrame();
}

/*

var manipulator;

// Load asset
var Bscene = new THREE.Scene();
var loader = new THREE.GLTFLoader();
loader.load('assets/test.gltf', function (gltf){
  Bscene.add(gltf.scene)

  // アニメーションの操作者を作成
  manipulator = new Utsuroi.Manipulator(gltf.scene, gltf.animations); 

  // 初期状態として再生したいアニメーション名を指定
  manipulator.play('1', true);
});


function bpm(){
  if(beat>100){
    manipulator.to('1', 100, true);
    renderer.render(scene, camera);
  }
  if(beat<100){
    manipulator.to('2', 100, true);
    renderer.render(scene, camera);
  }
};
*/

async function start() {
  const tmp = document.getElementById("avatar").value; //avaterの種類を格納
  const input = document.getElementById("input");
  const output = document.getElementById("output");
  const vrm_parent = document.getElementById("vrm_parent");
  setupScene(vrm_parent, tmp);
  await setupCamera(input);
  const model = await facemesh.load({ maxFaces: 1 });
  startRender(input, output, model);
  //bpm();
  initData();
}