var Lifx = require('node-lifx/lib/lifx').Client;
var _ = require('lodash/lodash');
var client = new Lifx();

var PORT = 3087;
var HOST = '0.0.0.0';

lightsMap = [
  'd073d5012d09',
  'd073d5032df3',
  'd073d5012d09'
];
lights = [];
lightState = {};
var dgram = require('dgram');
var server = dgram.createSocket('udp4');

server.on('listening', function () {
    var address = server.address();
    console.log('UDP Server listening on ' + address.address + ":" + address.port);
});

server.on('message', function (message, remote) {
    var data = JSON.parse(message);

    console.log(remote.address + ':' + remote.port +' - ' + JSON.stringify(data));

    if (data.type==='changeRemote'){
        var id;
        var light;
        if ((id = lightsMap[data.index]) && (light = _.find(lights, {id: id}))){
            if (data.state == 0) light.off();
            if (data.state == 1) light.on();
            lightState[light.id] = data.state;
        }
    }
});



client.on('error', function(err) {
  console.log('LIFX error:\n' + err.stack);
  client.destroy();
});

client.on('message', function(msg, rinfo) {
  if (typeof msg.type === 'string') {
    // Known packages send by the lights as broadcast
    switch (msg.type) {
      case 'echoResponse':
      case 'getOwner':
      case 'stateOwner':
      case 'getGroup':
      case 'getVersion':
      case 'stateGroup':
      case 'getLocation':
      case 'stateLocation':
      case 'stateTemperature':
        console.log(msg, ' from ' + rinfo.address);
        break;
      default:
        //console.log(msg)
        break;
    }
  } else {
    // Unknown message type
    console.log(msg, ' from ' + rinfo.address);
  }
});

client.on('light-new', function(light) {
  console.log('New light found. ID:' + light.id + ', IP:' + light.address + ':' + light.port);
  lights.push(light);
});

client.on('light-online', function(light) {
  console.log('Light back online. ID:' + light.id + ', IP:' + light.address + ':' + light.port);
});

client.on('light-offline', function(light) {
  console.log('Light offline. ID:' + light.id + ', IP:' + light.address + ':' + light.port);
});


client.on('listening', function() {
  var address = client.address();
  console.log(
    'Started LIFX listening on ' +
    address.address + ':' + address.port + '\n'
  );
});


setInterval(function(){
  lights.forEach(function(light){
    light.getState(function(err, info) {
        if (err) {
          console.log(err);
        } else {
          if (info.power>1) info.power=1;
          if(info.power != lightState[light.id]){
            lightState[light.id] = info.power;

            console.log("id:"+light.id+" power:"+info.power);

            //send update to controller
            message = new Buffer(JSON.stringify({
              action: "updateState",
              index:  ""+lightsMap.indexOf(light.id),
              state: ""+info.power
            }));
            server.setBroadcast(true);
            server.send(message, 0, message.length, PORT, "255.255.255.255", function(err, bytes) {
                if (err) throw err;
                console.log('UDP message sent');
            })
          }
        }
           
        //console.log('Label: ' + info.label);
        //console.log('Power:', (info.power === 1) ? 'on' : 'off');
        //console.log('Color:', info.color, '\n');
    });
  });
}, 10000);

client.init();
server.bind(PORT, HOST);
