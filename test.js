function setupScene(vrm_parent, avatar_name) {  //シーンを設定
  window.renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#myCanvas')
  });
  renderer.setSize(320, 240);
  renderer.setPixelRatio(window.devicePixelRatio);
  vrm_parent.appendChild(renderer.domElement);
  window.camera = new THREE.PerspectiveCamera(50.0, 4.0 / 3.0, 0.1, 5.0);
  window.scene = new THREE.Scene();
  scene.add(new THREE.DirectionalLight(0xffffff));
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
  camera.position.set(0.0, head.getWorldPosition(new THREE.Vector3()).y + 0.05, 0.5);
  window.clock = new THREE.Clock();
  clock.start();
  renderer.render(scene, camera);
}

async function setupCamera(videoElement) {  //カメラを用意
  const constraints = { video: { width: 320, height: 240 }, audio: true }; 
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  let myaudio = stream.getAudioTracks()[0];  //カメラから音声を抜き取る
  videoElement.srcObject = stream;
  const canvas2 = document.getElementById("myCanvas");
  var avatarcamera = canvas2.captureStream(60);
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const shifter = new Tone.PitchShift(5);
  const reverb = new Tone.Freeverb();
  const effectedDest = Tone.context.createMediaStreamDestination();
  source.connect(shifter);
  shifter.connect(reverb);
  reverb.connect(effectedDest);
  const effectedTrack = effectedDest.stream.getAudioTracks()[0];
  avatarcamera.addTrack(effectedTrack);  //avatar画面に音声を追加


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

function startRender(input, output, model) {
  const ctx = output.getContext("2d");
  async function renderFrame() {
    requestAnimationFrame(renderFrame);
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



async function start() {
  const tmp = document.getElementById("avatar").value; //avaterの種類を格納
  const input = document.getElementById("input");
  const output = document.getElementById("output");
  const vrm_parent = document.getElementById("vrm_parent");
  setupScene(vrm_parent, tmp);
  await setupCamera(input);
  const model = await facemesh.load({ maxFaces: 1 });
  startRender(input, output, model);
}