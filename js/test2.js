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
const $video = document.getElementById('webcam-video')
const $landmarkCanvas = document.getElementById('landmarks')

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
	renderer.gammaOutput = true;
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
	arToolkitSource.init(onReady = () => { resize() });

	artoolkitProfile.contextParameters.patternRatio = patternRatio;
	artoolkitProfile.contextParameters.cameraParametersUrl = "assets/camera_para.dat";
	//artoolkitProfile.contextParameters.detectionMode = "color_and_matrix";
	artoolkitProfile.contextParameters.maxDetectionRate = maxDetectionRate;

	arToolkitContext = new THREEx.ArToolkitContext(artoolkitProfile.contextParameters);
	arToolkitContext.init(onCompleted = () => {
		camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
	});

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
}
*/
(async () => {
$video.srcObject = await navigator.mediaDevices.getUserMedia({ video: {facingMode: "user"} })
})()
$video.play().then(async () => {
    // Load learned models
    await faceapi.nets.tinyFaceDetector.load('/weights')
    await faceapi.loadFaceLandmarkModel('/weights')
    await faceapi.loadFaceExpressionModel('/weights')
    const loop = async () => {
      if (!faceapi.nets.tinyFaceDetector.params) {
        return setTimeout(() => loop())
      }
      // Exampleを参考に設定
      const option = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
      const result = await faceapi.detectSingleFace($video, option).withFaceLandmarks().withFaceExpressions()
      if (result) {
        // デバッグをしつつ決めた値をスレッショルドとする(表情筋が硬い場合は下げようね！)
        if (result.expressions.happy > 0.7) {
          smiling = true
        }
        // 頭部回転角度を鼻のベクトルに近似する
        // 68landmarksの定義から鼻のベクトルを求める
        const upperNose = result.landmarks.positions[27]
        const lowerNose = result.landmarks.positions[30]
        let noseVec = lowerNose.sub(upperNose)
        noseVec = new THREE.Vector2(noseVec.x, noseVec.y)
        // angle関数はx+方向を基準に角度を求めるため、π/2引いておき、逆回転のマイナスをかける
        headYawAngle = -(noseVec.angle() - (Math.PI / 2))
        // リップシンク
        // 68landmarksの定義から、口の垂直距離を測る
        const upperLip = result.landmarks.positions[51]
        const lowerLip = result.landmarks.positions[57]
        lipDist = lowerLip.y - upperLip.y
        // デバッグ用にcanvasに表示する
        const dims = faceapi.matchDimensions($landmarkCanvas, $video, true)
        const resizedResult = faceapi.resizeResults(result, dims)
        faceapi.draw.drawFaceLandmarks($landmarkCanvas, resizedResult)
      }
      setTimeout(() => loop())
    }
	loop()
})
//VRMモデルの読み込み
const loadModel = async () => {
	//vrmファイルの読み込み
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

			const mesh = new THREE.Mesh(
        		new THREE.CubeGeometry(1, 1, 1),
        		new THREE.MeshNormalMaterial(),
      		);
      		mesh.position.x = 1.0;
			markerScene.add(mesh);
			const gridHelper = new THREE.GridHelper(10, 10)
  			scene.add(gridHelper)
  			const axesHelper = new THREE.AxesHelper(5)
  			scene.add(axesHelper)

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

//更新処理
const update = async () => {
	requestAnimationFrame(update);

	if (vrm) {
		const deltaTime = clock.getDelta()
		let s = Math.sin(Math.PI * clock.elapsedTime)
		if (smiling) {
		  s *= 2
		  vrm.blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.A, 0)
		  vrm.blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Joy, s)
		  if (Math.abs(s) < 0.1) {
			smiling = false
			vrm.blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Joy, 0)
		  }
		} else if (blinking) {
		  s *= 5
		  vrm.blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Blink, s)
		  if (Math.abs(s) < 0.1) {
			blinking = false
			vrm.blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Blink, 0)
		  }
		}
		// vrm.blendShapeProxy.setValue( 'a', 0.5 + 0.5 * s );
		if (lipDist && !smiling) {
		  // 初期距離(30)を引いて、口を最大限に開けた時を最大値とした時を参考に割合を決める
		  let lipRatio = (lipDist - 30) / 25
		  if (lipRatio < 0) {
			lipRatio = 0
		  } else if (lipRatio > 1) {
			lipRatio = 1
		  }
		  vrm.blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.A, lipRatio)
		}
		if (headYawAngle) {
		  if (Math.abs(prevHeadYawAngle - headYawAngle) > 0.02) {
			// 変化を増幅させる
			const y = headYawAngle * 2.5
			if (Math.abs(y) < Math.PI / 2) {
			  vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Head).rotation.y = y
			}
		  }
		  prevHeadYawAngle = headYawAngle
		}
		vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.LeftUpperArm).rotation.z = Math.PI / 3
		vrm.humanoid.getBoneNode(VRMSchema.HumanoidBoneName.RightUpperArm).rotation.z = -Math.PI / 3
  
		// update vrm
		vrm.update(deltaTime)
	  }

	if(arToolkitSource.ready === false){ return; }
	arToolkitContext.update(arToolkitSource.domElement);

	smoothedControls.update(markerGroup);

	let delta = clock.getDelta();
	//if(mixer){ mixer.update(delta); }

	renderer.render(scene, camera);
	//stats.update();
}




//初期化処理の開始
init();
