wsUri = 'http://localhost:1242';
socketio = io(wsUri);
socketio.on('beats', (DeviceID, ComputedHeartRate) => {
    console.log(DeviceID, ComputedHeartRate);
    if(id == DeviceID) updateData(ComputedHeartRate);
    else if(!id) updateData(ComputedHeartRate);
    beat = ComputedHeartRate; 
});

let updateData = (beat) => {
    console.log(data.length);
    lastBeat = beat;
    document.querySelector('#textArea').textContent = beat;
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

// Main
let data = []
let chart, beatMotionLoop, lastBeat;
let id = getParam('id') || 0;