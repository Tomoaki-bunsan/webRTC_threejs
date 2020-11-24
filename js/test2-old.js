//import * as faceapi from './face-api.js'

//モデルの位置
const posX = 0;
const posY = 0;
const posZ = 1.5;
//モデルのサイズ
const scale = 2;
let vrm
let blinking = false
let smiling = false
let lipDist
let headYawAngle
let prevHeadYawAngle
const $video = document.getElementById('input')
var mesh


//黒枠の幅（ジェネレータのPatternRatioと合わせる）
const patternRatio = 0.7;
//マーカーを検出するフレームレート
const maxDetectionRate = 30;

const getURLParam = (name, url) => {
	if(!url){ url = window.location.href; }

	name = name.replace(/[\[\]]/g, "\\$&");
	let regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
	results = regex.exec(url);

	if(!results){ return null; }
	if(!results[2]){ return ''; }

	return decodeURIComponent(results[2].replace(/\+/g, " "));
}
//GETのstandに1が指定されているならQRに対して垂直に立たせる
//e.g. https://hogehoge?stand=1
const stand = (getURLParam("stand") == 1) ? true : false; 

let renderer, scene, camera;
let arToolkitSource, arToolkitContext;
let markerGroup, markerScene;
let smoothedControls;
let mixer;

const clock = new THREE.Clock();
//const stats = new Stats();
//document.body.appendChild(stats.dom);
const loading = document.getElementById("loading");

//THREEのレンダラの初期化
const initRenderer = async () => {
	//z-fighting対策でlogarithmicDepthBufferを指定
	renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#myCanvas'), alpha: true, antialias: true, logarithmicDepthBuffer: true });
	renderer.outputEncoding = THREE.sRGBEncoding;
	renderer.setClearColor(new THREE.Color(0xffffff), 0);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.domElement.style.position = "absolute";
	renderer.domElement.style.top = "0px";
	renderer.domElement.style.left = "0px";
	document.body.appendChild(renderer.domElement);
}
//THREEのシーンの初期化
const initScene = async () => {
	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1000, 10000);
	scene.add(camera);

	const light = new THREE.AmbientLight(0xffffff, 1.0);
	scene.add(light);

	const artoolkitProfile = new THREEx.ArToolkitProfile();
	artoolkitProfile.sourceWebcam();

	arToolkitSource = new THREEx.ArToolkitSource(artoolkitProfile.sourceParameters);
	arToolkitSource.init(function onReady() {
		// use a resize to fullscreen mobile devices
		setTimeout(function () {
			resize()
		}, 1000);
	})

	artoolkitProfile.contextParameters.patternRatio = patternRatio;
	artoolkitProfile.contextParameters.cameraParametersUrl = "assets/camera_para.dat";
	//artoolkitProfile.contextParameters.detectionMode = "color_and_matrix";
	artoolkitProfile.contextParameters.maxDetectionRate = maxDetectionRate;

	arToolkitContext = new THREEx.ArToolkitContext(artoolkitProfile.contextParameters);
	arToolkitContext.init(function onCompleted() {
		// copy projection matrix to camera
		camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
	})

	window.onresize = resize;
	resize();

	markerGroup = new THREE.Group();
	scene.add(markerGroup);

	const markerControls = new THREEx.ArMarkerControls(arToolkitContext, markerGroup, {
		type : "pattern",
		patternUrl : "assets/marker.patt",
	});

	const smoothedGroup = new THREE.Group();
	scene.add(smoothedGroup);

	smoothedControls = new THREEx.ArSmoothedControls(smoothedGroup);

	markerScene = new THREE.Scene();
	smoothedGroup.add(markerScene);

	
	//VRMモデルの読み込み
	const result = await loadModel();

	return result;
}

//ブラウザのリサイズ時の処理
const resize = () => {
	arToolkitSource.onResizeElement();
	arToolkitSource.copyElementSizeTo(renderer.domElement);
	if(arToolkitContext.arController !== null){
		arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);
	}
}

(async () => {
	$video.srcObject = await navigator.mediaDevices.getUserMedia({ video: {facingMode: "user"}, audio:true})
	let myaudio = $video.srcObject.getAudioTracks()[0];
})()
/*async function setupCamera(videoElement) {    //カメラを用意
    const constraints = {video: {width: 320,height: 240, facingMode: "user"}, audio: true};
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;
    return new Promise(resolve => {
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        resolve();
      };
    });
}*/

async function initVRM(gltf) {
    window.vrm = await THREE.VRM.from(gltf);
    markerScene.add(vrm.scene);
    vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.Hips).rotation.y = Math.PI;
    vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.LeftUpperArm).rotation.z = Math.PI * 2 / 5;
    vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.RightUpperArm).rotation.z = -Math.PI * 2 / 5;
    const head = vrm.humanoid.getBoneNode( THREE.VRMSchema.HumanoidBoneName.Head );
    window.clock = new THREE.Clock();
    clock.start();
    renderer.render(scene, camera);
}

//VRMモデルの読み込み
const loadModel = async () => {
	//vrmファイルの読み込み
	new THREE.GLTFLoader().load(    //3dモデルを読み込み
		"https://pixiv.github.io/three-vrm/examples/models/three-vrm-girl.vrm",
		initVRM, 
		progress => console.log("Loading model...",100.0 * (progress.loaded / progress.total),"%"),
		console.error
	  );
	const vrmLoader = new THREE.VRMLoader();
	const result = await new Promise(resolve => {
		vrmLoader.load("models/男女兼用JK.vrm", (vrm) => {
			vrm.scene.position.x = posX;
			vrm.scene.position.y = posY;
			vrm.scene.position.z = posZ;
			vrm.scene.scale.x = scale;
			vrm.scene.scale.y = scale;
			vrm.scene.scale.z = scale;
			vrm.scene.rotation.x = 0.0;
			vrm.scene.rotation.y = Math.PI;
			vrm.scene.rotation.z = 0.0;
			if(!stand){ vrm.scene.rotation.x = -Math.PI / 2.0; }

			markerScene.add(vrm.scene);
			vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.Hips).rotation.y = Math.PI;
    		vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.LeftUpperArm).rotation.z = Math.PI * 2 / 5;
    		vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.RightUpperArm).rotation.z = -Math.PI * 2 / 5;
			mesh = new THREE.Mesh(
        		new THREE.CubeGeometry(1, 1, 1),
        		new THREE.MeshNormalMaterial(),
      		);
      		mesh.position.x = 1.0;
			markerScene.add(mesh);
			const gridHelper = new THREE.GridHelper(10, 10)
  			markerScene.add(gridHelper)
  			const axesHelper = new THREE.AxesHelper(5)
  			markerScene.add(axesHelper)

			// VRMLoader doesn't support VRM Unlit extension yet so
			// converting all materials to MeshBasicMaterial here as workaround so far.
			vrm.scene.traverse((object) => {
				if(!object.material){ return; }

				if(Array.isArray(object.material)){
					for(let i = 0, il = object.material.length; i < il; i ++){
						const material = new THREE.MeshBasicMaterial();
						THREE.Material.prototype.copy.call(material, object.material[i]);
						material.color.copy(object.material[i].color);
						material.map = object.material[i].map;
						material.lights = false;
						material.skinning = object.material[i].skinning;
						material.morphTargets = object.material[i].morphTargets;
						material.morphNormals = object.material[i].morphNormals;
						object.material[i] = material;
					}
				}else{
					const material = new THREE.MeshBasicMaterial();
					THREE.Material.prototype.copy.call(material, object.material);
					material.color.copy(object.material.color);
					material.map = object.material.map;
					material.lights = false;
					material.skinning = object.material.skinning;
					material.morphTargets = object.material.morphTargets;
					material.morphNormals = object.material.morphNormals;
					object.material = material;
				}
			});

			/*  mixer = new THREE.AnimationMixer(vrm.scene);

			//別のgltfからモーションを借用。本来は不要な処理
			//http://examples.claygl.xyz/examples/basicModelAnimation.html
			const boneLoader = new THREE.GLTFLoader();
			boneLoader.load("assets/SambaDancing.gltf", function(bone){
				const animations = bone.animations;
				if(animations && animations.length){
					for(let animation of animations){
						correctBoneName(animation.tracks);
						correctCoordinate(animation.tracks);
						mixer.clipAction(animation).play();
					}
				}
			});
			*/
			return resolve(vrm.scene);
		});
	});

	return result;
}

setInterval(() => {
    if (Math.random() < 0.15) {
      blinking = true
    }
  }, 1000)

//音量取得
var ctx, analyser, frequencies, getByteFrequencyDataAverage, elVolume, draw;

window.AudioContext = window.AudioContext || window.webkitAudioContext;
ctx = new AudioContext();

analyser = ctx.createAnalyser();
frequencies = new Uint8Array(analyser.frequencyBinCount);
//計算
getByteFrequencyDataAverage = function() {
    analyser.getByteFrequencyData(frequencies);
    return frequencies.reduce(function(previous, current) {
        return previous + current;
    }) / analyser.frequencyBinCount;
};

navigator.mediaDevices.getUserMedia({audio: true})
    .then(function(stream) {
        window.hackForMozzila = stream;
        ctx.createMediaStreamSource(stream)
          // AnalyserNodeに接続
          .connect(analyser);
    })
    .catch(function(err) {
        console.log(err.message);
	});
	
// 音量
elVolume = Math.floor(getByteFrequencyDataAverage());



//初期化処理
const init = async () => {
	let resRenderer = initRenderer();
	let resScene = initScene();

	//レンダラ、シーンの初期化が済んでいるか
	await Promise.all([resRenderer, resScene]);
	loading.style.display = "none";

	//更新処理の開始
	requestAnimationFrame(update);
}

function estimatePose(annotations) {    //顔の角度の計算
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

function startRender(input, output, model) {    //顔の検出と描画
    const ctx2 = output.getContext("2d");
    async function renderFrame() {
      requestAnimationFrame(renderFrame);
      vrm.update(clock.getDelta());
      const faces = await model.estimateFaces(input, false, false);
      ctx2.clearRect(0, 0, output.width, output.height);
      faces.forEach(face => {
        face.scaledMesh.forEach(xy => {
          ctx2.beginPath();
          ctx2.arc(xy[0], xy[1], 1, 0, 2 * Math.PI);
          ctx2.fill();
        });
        const annotations = face.annotations;
        const q = estimatePose(annotations);
        const head = vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.Head);
        head.quaternion.slerp(q, 0.1);
        const blink = Math.max( 0.0, 1.0 - 10.0 * Math.abs( ( clock.getElapsedTime() % 4.0 ) - 2.0 ) );
        vrm.blendShapeProxy.setValue(THREE.VRMSchema.BlendShapePresetName.Blink, blink);
        const lipsLowerInner = annotations.lipsLowerInner[5];
        const lipsUpperInner = annotations.lipsUpperInner[5];
        const expressionA = Math.max(0, Math.min(1, (lipsLowerInner[1] - lipsUpperInner[1])/10.0));
        vrm.blendShapeProxy.setValue(THREE.VRMSchema.BlendShapePresetName.A, expressionA);
	  });
	  //音量に合わせて回転
		mesh.rotation.x += 0.02;	// x軸方向に回転
    	mesh.rotation.y += 0.02;	// y軸方向に回転
   		mesh.rotation.z += 0.02;	// z軸方向に回転
      	renderer.render(scene, camera);
    }
    renderFrame();
  }

  const update = async () => {
	requestAnimationFrame(update);

	if (vrm) {
		const deltaTime = clock.getDelta()
		const ctx2 = output.getContext("2d");
		vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.LeftUpperArm).rotation.z = Math.PI / 3
		vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.RightUpperArm).rotation.z = -Math.PI / 3
		const faces = await model.estimateFaces(input, false, false);
      	ctx2.clearRect(0, 0, output.width, output.height);
      	faces.forEach(face => {
        	face.scaledMesh.forEach(xy => {
         	 	ctx2.beginPath();
         		ctx2.arc(xy[0], xy[1], 1, 0, 2 * Math.PI);
          		ctx2.fill();
        	});
        	const annotations = face.annotations;
        	const q = estimatePose(annotations);
        	const head = vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.Head);
        	head.quaternion.slerp(q, 0.1);
        	const blink = Math.max( 0.0, 1.0 - 10.0 * Math.abs( ( clock.getElapsedTime() % 4.0 ) - 2.0 ) );
        	vrm.blendShapeProxy.setValue(THREE.VRMSchema.BlendShapePresetName.Blink, blink);
        	const lipsLowerInner = annotations.lipsLowerInner[5];
        	const lipsUpperInner = annotations.lipsUpperInner[5];
        	const expressionA = Math.max(0, Math.min(1, (lipsLowerInner[1] - lipsUpperInner[1])/10.0));
        	vrm.blendShapeProxy.setValue(THREE.VRMSchema.BlendShapePresetName.A, expressionA);
	  	});
		// update vrm
		vrm.update(deltaTime)
	  }

	if(arToolkitSource.ready === false){ return; }
	arToolkitContext.update(arToolkitSource.domElement);

	smoothedControls.update(markerGroup);

	mesh.rotation.x += 0.02;	// x軸方向に回転
	mesh.rotation.y += 0.02;	// y軸方向に回転
	mesh.rotation.z += 0.02;	// z軸方向に回転
	renderer.render(scene, camera);
}

	





//初期化処理の開始
init();

async function start() {
    const input = document.getElementById("input");
    const output = document.getElementById("output");
    const vrm_parent = document.getElementById("vrm_parent");
    loading(true);

	await setupCamera(input);
    const model = await facemesh.load({ maxFaces: 1 });
    startRender(input, output, model);
    loading(false);
  }
