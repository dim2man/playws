const expressWs = require('express-ws');
const clients = new WeakMap(); // name -> connection
const games = new WeakMap(); // name -> {player_name, gamename, status}
const CMD = {
	iam: 'iam ',
	offer: 'offer ',
	confirm: 'confirm ',
	msg: 'msg ', 
};
const STATUS = {
	offer: '0',
	confirm: '1',
};

exports.setupWs = (app) => {
	const wss = expressWs(app);

	app.ws('/ws', (conn, req) => {
		console.log('in app.ws');
		let name;
		conn.on('error', console.error);
		conn.on('message', msg => {
			console.log(`>>>>> ${name}\n${msg}`);
			switch(true) {

			case msg.startsWith(CMD.iam):
				const payload = msg.slice(CMD.iam.length);
				if (name || !payload) return;
				name = payload;
				clients.set(name, conn);
				break;

			case msg.startsWith(CMD.offer): {
					const payload = msg.slice(CMD.offer.length);
					if (!payload || games.has(name)) return;
					const [gamename, player_name] = payload.split('\n');
					if (!clients.has(player_name)) return;
					games.set(name, {player_name, gamename, status: STATUS.offer});
					clients.get(player_name).send(`${CMD.offer}${gamename}\n${name}`);
				}
				break;

			case msg.startsWith(CMD.confirm): {
					const payload = msg.slice(CMD.confirm.length);
					if (!payload || games.has(name)) return;
					const [gamename, player_name] = payload.split('\n');
					if (!clients.has(player_name) || !games.has(player_name)) return;
					const game = games.get(player_name);
					if (game.player_name !== name || game.gamename !== gamename || game.status !== STATUS.offer) return;
					games.set(name, {player_name, gamename, status: STATUS.confirm});
					games.set(player_name, {...game, status: STATUS.confirm});
					clients.get(player_name).send(`${CMD.confirm}${gamename}\n${name}`);
				}
				break;

			case msg.startsWith(CMD.msg): {
					if (!games.has(name)) return;
					const game = games.get(name);
					if (!clients.has(game.player_name)) return;
					clients.get(game.player_name).send(msg);
				}
				break;

			};
		});
		conn.on('close', msg => {
			if (name) {
				clients.delete(name);
			}
		});
	});
};

// protocol: <command><space><data>
// commands:
// > iam <name>
// > offer <gamename>\n<player_name>
// > confirm <gamename>\n<player_name>
// > msg <msg>
