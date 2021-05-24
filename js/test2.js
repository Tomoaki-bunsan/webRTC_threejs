var wsUri = 'http://localhost:1242';
var socketio = io(wsUri);
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

//モデルの位置
const posX = 0;
const posY = 0;
const posZ = 1.5;
//モデルのサイズ
const scale = 2;
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
const clock = new THREE.Clock();
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
    const ARlight = new THREE.DirectionalLight(0xffffff, 0.75);
	markerScene.add(ARlight);
    new THREE.GLTFLoader().load(    //3dモデルを読み込み
        "models/男女兼用JK.vrm",
        initVRM, 
        progress => console.log("Loading model...",100.0 * (progress.loaded / progress.total),"%"),
        console.error
    );
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
}

//ブラウザのリサイズ時の処理
const resize = () => {
	arToolkitSource.onResizeElement();
	arToolkitSource.copyElementSizeTo(renderer.domElement);
	if(arToolkitContext.arController !== null){
		arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);
	}
}

//カメラを用意
(async () => {
	$video.srcObject = await navigator.mediaDevices.getUserMedia({ video: {facingMode: "user"}, audio:true})

    console.log("camera");
})()


async function initVRM(gltf) {
    window.vrm = await THREE.VRM.from(gltf);
    vrm.scene.position.x = posX;
	vrm.scene.position.y = posY;
	vrm.scene.position.z = posZ;
	vrm.scene.scale.x = scale;
	vrm.scene.scale.y = scale;
	vrm.scene.scale.z = scale;
	vrm.scene.rotation.x = 0.0;
	vrm.scene.rotation.y = 0.0;
    vrm.scene.rotation.z = 0.0;
    if(!stand){ vrm.scene.rotation.x = -Math.PI / 2.0; }//ここを消すとqrに垂直になる
    markerScene.add(vrm.scene);
    vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.Hips).rotation.y = Math.PI;
    vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.LeftUpperArm).rotation.z = Math.PI * 2 / 5;
    vrm.humanoid.getBoneNode(THREE.VRMSchema.HumanoidBoneName.RightUpperArm).rotation.z = -Math.PI * 2 / 5;
    const head = vrm.humanoid.getBoneNode( THREE.VRMSchema.HumanoidBoneName.Head );
    window.clock = new THREE.Clock();
    clock.start();
    renderer.render(scene, camera);
    console.log("initVRM");
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
    console.log("estimatePose");
}
//顔の検出と描画
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
        const blink = Math.max( 0.0, 1.0 - 10.0 * Math.abs( ( clock.getElapsedTime() % 4.0 ) - 2.0 ) );
        vrm.blendShapeProxy.setValue(THREE.VRMSchema.BlendShapePresetName.Blink, blink);
        const lipsLowerInner = annotations.lipsLowerInner[5];
        const lipsUpperInner = annotations.lipsUpperInner[5];
        const expressionA = Math.max(0, Math.min(1, (lipsLowerInner[1] - lipsUpperInner[1])/10.0));
        vrm.blendShapeProxy.setValue(THREE.VRMSchema.BlendShapePresetName.A, expressionA);
      });
      renderer.render(scene, camera);
    }
    renderFrame();
    console.log("startRender");
}
const init = async () => {
	let resRenderer = initRenderer();
	let resScene = initScene();

	//レンダラ、シーンの初期化が済んでいるか
	await Promise.all([resRenderer, resScene]);
	loading.style.display = "none";

	//更新処理の開始
	requestAnimationFrame(update);
}
let angleRad = 0;
let scaling = 0;
//更新処理
const update = async () => {
	requestAnimationFrame(update);

	if(arToolkitSource.ready === false){ return; }
	arToolkitContext.update(arToolkitSource.domElement);

	smoothedControls.update(markerGroup);
    //mesh.rotation.x += 0.001*beat;	// x軸方向に回転
    //mesh.rotation.y += 0.001*beat;	// y軸方向に回転
    

    angleRad += 1 * Math.PI / 180;
    scaling = 0.8*Math.sin(beat*0.05*angleRad);
    
    mesh.scale.x = 0.2+scaling;
    mesh.scale.y = 0.2+scaling;
    mesh.scale.z = 0.2+scaling;
    /*if(beat>100){
        var loader = new THREE.FontLoader();
        loader.load('helvetiker_regular.typeface.json', function(font){
	    var textGeometry = new THREE.TextGeometry("nervous!", {
		  font: font,
		  size: 20,
		  height: 5,
		  curveSegments: 12
    	});
	    var materials = [
		    new THREE.MeshBasicMaterial( { color: Math.random() * 0xffffff, overdraw: 0.5 } ),
		    new THREE.MeshBasicMaterial( { color: 0x000000, overdraw: 0.5 } )
	    ];
	    var textMesh = new THREE.Mesh(textGeometry, materials);
	    scene.add(textMesh);
      });
    }*/
	renderer.render(scene, camera);

}

//初期化処理の開始
init();

/*  音量取得
var ctx2, analyser, frequencies, getByteFrequencyDataAverage, elVolume = 1, draw;

window.AudioContext = window.AudioContext || window.webkitAudioContext;
ctx2 = new AudioContext();

analyser = ctx2.createAnalyser();
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
        ctx2.createMediaStreamSource(stream)
          // AnalyserNodeに接続
          .connect(analyser);
    })
    .catch(function(err) {
        console.log(err.message);
	});
	
// 音量
elVolume = Math.floor(getByteFrequencyDataAverage());
console.log(elVolume);
*/

//ここが動かない
async function start() {
    const output = document.getElementById("output");
    const model = await facemesh.load({ maxFaces: 1 });
    startRender(input, output, model);
  }



// SkyWay(WebRTC)
 const peer = new Peer({
    key: '72aa90ed-09d6-439b-9a8b-138055d85ca7',
    debug: 3
});

peer.on('open', () => {
    document.getElementById('my-id').textContent = peer.id;
});

let localStream;


const localId = document.getElementById('my-id');
const videosContainer = document.getElementById('videos-container');

const roomId = document.getElementById('room-id');
const messages = document.getElementById('messages');
const joinTrigger = document.getElementById('join-trigger');
const leaveTrigger = document.getElementById('leave-trigger');

const localText = document.getElementById('local-text');
const sendTrigger = document.getElementById('send-trigger');
const nickname = document.getElementById('nickname');


joinTrigger.addEventListener('click', () => {
    const room = peer.joinRoom(roomId.value, {
        mode: 'mesh',
        stream: localStream,
    });

    room.on('open', () => {
        messages.textContent += `===You joined===\n`;
    });

    room.on('peerJoin', peerId => {
        messages.textContent += `===${peerId} joined===\n`;
    });


    room.on('data', ({ data, src }) => {
        // Show a message sent to the room and who sent
        messages.textContent += `${src} ${data}\n`;
    });

    sendTrigger.addEventListener('click', onClickSend);

    function onClickSend() {
        // Send message to all of the peers in the room via websocket
        room.send(`(${nickname.value}): ${localText.value}`);

        messages.textContent += `${peer.id}(${nickname.value}): ${localText.value}\n`;
        localText.value = '';
    }


    room.on('stream', async stream => {
        const remoteVideo = document.createElement('video');
        remoteVideo.style.height =  '240px';
        remoteVideo.srcObject = stream;
        remoteVideo.playsInline = true;
        remoteVideo.setAttribute('data-peer-id', stream.peerId);
        videosContainer.append(remoteVideo);

        await remoteVideo.play().catch(console.error);
    });

    room.on('peerLeave', peerId => {
        const remoteVideo = videosContainer.querySelector(`[data-peer-id="${peerId}"]`);
        remoteVideo.srcObject.getTracks().forEach(track => {
            track.stop();
        });
        remoteVideo.srcObject = null;
        remoteVideo.remove();

        messages.textContent += `===${peerId} left===\n`;
    });

    room.once('close', () => {
        messages.textContent += '===You left ===\n';
        const remoteVideos = videosContainer.querySelectorAll('[data-peer-id]');
        Array.from(remoteVideos)
            .forEach(remoteVideo => {
                remoteVideo.srcObject.getTracks().forEach(track => track.stop());
                remoteVideo.srcObject = null;
                remoteVideo.remove();
            });
    });

    leaveTrigger.addEventListener('click', () => {
        room.close();
    }, { once: true });
});

