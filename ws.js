const expressWs = require('express-ws');
const clients = {}; // name -> connection
const games = {}; // name -> {player_name, gamename, status}
const CMD = {
	iam: 'iam',
	nok: 'nok',
	ok: 'ok',
	to: 'to',
	from: 'from',
	offer: 'offer',
	confirm: 'confirm',
	finish: 'finish',
	msg: 'msg', 
	dump: 'dump',
};
const STATUS = {
	offer: '0',
	confirm: '1',
};

const MAX_CONN = 100;
let totalConn = 0;
function checkConn(conn, req) {
	// const ipid = getIpId(req);
	// TODO
}

function getIpId(req) {
	const ip = req.socket.remoteAddress;
	const xff = req.headers['x-forwarded-for'];
	if (!xff) return ip;
	return [...xff.split(',').map(s => s.trim()), ip].filter((s, i, a) => {
		for(j=0; j<i; j++) {
			if (s === a[j]) return false;
		}
		return true;
	}).join(',');
}

function trace(msg, isIncoming) {
	console.log(`${new Date().toISOString()} ${isIncoming ? '>>>>' : '<<<<'} ${msg}`);
}

function send(conn, name, msg) {
	trace(`${name || 'anonymous'}: ${msg}`);
	conn.send(msg);
}

exports.setupWs = function(app) {
	const wss = expressWs(app);

	app.ws('/ws', (conn, req) => {
		const ipid = getIpId(req);
		trace(`new connection from ${ipid}`, true);
		let name;
		conn.on('error', console.error);
		conn.on('message', msg => {
			trace(`${name || 'anonymous'}: ${msg}`, true);
			switch(true) {

			case msg.startsWith(CMD.iam): {
					const payload = msg.substring(CMD.iam.length).trim();
					if (name) {
						send(conn, name, `${CMD.nok} name is already set`);
						return;
					}
					if (!payload) {
						send(conn, name, `${CMD.nok} name cannot be empty`);
						return;
					}
					if (clients[payload]) {
						send(conn, name, `${CMD.nok} name is already used`);
						return;
					}
					name = payload;
					clients[name] = conn;
					send(conn, name, CMD.ok);
				}
				break;

			case msg.startsWith(CMD.offer): {
					const payload = msg.substring(CMD.offer.length).trim();
					if (!name) {
						send(conn, name, `${CMD.nok} name must be set before, use ${CMD.iam} command`);
						return;
					}
					if (!payload) {
						send(conn, name, `${CMD.nok} payload cannot empty`);
						return;
					}
					const [gamename, player_name] = payload.split(` ${CMD.to} `).map(s => s.trim());
					if (!gamename) {
						send(conn, name, `${CMD.nok} gamename cannot empty`);
						return;
					}
					if (!player_name) {
						send(conn, name, `${CMD.nok} player_name cannot empty`);
						return;
					}
					const partnerGame = games[player_name];
					const partnerConn = clients[player_name];
					if (partnerGame && partnerConn && partnerGame.gamename === gamename && partnerGame.player_name === name && partnerGame.status === STATUS.offer) {
						games[name] = {player_name, gamename, status: STATUS.confirm};
						partnerGame.status = STATUS.confirm;
						send(conn, name, `${CMD.confirm} ${gamename} ${CMD.from} ${player_name}`);
						send(partnerConn, player_name, `${CMD.confirm} ${gamename} ${CMD.from} ${name}`);
					} else {
						games[name] = {player_name, gamename, status: STATUS.offer};
						send(conn, name, `${CMD.ok}`);
					}
				}
				break;

			case msg.startsWith(CMD.finish): {
					if (!name) {
						send(conn, name, `${CMD.nok} name must be set before, use ${CMD.iam} command`);
						return;
					}
					const game = games[name];
					if (!game) {
						send(conn, name, `${CMD.nok} no game exists`);
						return;
					}
					delete games[name];
					send(conn, name, CMD.ok);
				}
				break;

			case msg.startsWith(CMD.msg): {
					if (!name) {
						send(conn, name, `${CMD.nok} name must be set before, use ${CMD.iam} command`);
						return;
					}
					const game = games[name];
					if (!game) {
						send(conn, name, `${CMD.nok} no game exists`);
						return;
					}
					if (game.status !== STATUS.confirm) {
						send(conn, name, `${CMD.nok} game is not started`);
						return;
					}
					const partnerConn = clients[game.player_name];
					if (!partnerConn) {
						send(conn, name, `${CMD.nok} partner lost connection`);
						return;
					}
					send(partnerConn, game.player_name, msg);
				}
				break;

			case msg.startsWith(CMD.dump): {
					trace(`clients\n${JSON.stringify(Object.keys(clients), null, 2)}`);
					trace(`games\n${JSON.stringify(games, null, 2)}`);
				}
				break;

			};
		});
		conn.on('close', msg => {
			trace(`${name || 'anonymous'}: connection closed from ${ipid}`, true);
			if (name) {
				delete clients[name];
				delete games[name];
			}
		});
	});
};

// protocol: <command><space><data>
// commands:
// > iam <name>
// < ok | nok <reason>
// > offer <gamename> to <player_name>
// < ok | nok <reason> | confirm <gamename> from <player_name>
// > msg <msg>
// < ok | nok <reason>
