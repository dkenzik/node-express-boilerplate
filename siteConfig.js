var settings = {
	'sessionSecret': 'ItAintNoSecret'
	, 'port': 8080
	, 'uri': 'http://localhost:8080' // Without trailing /

	/*
	// Enter API keys to enable auth services, remove entire object if they aren't used.
	, 'external': {
		'facebook': {
			appId: '123983866527489',
			appSecret: '6edf1327ege27bbba2e239f73cd866c4'
		}
		, 'twitter': {
			consumerKey: 'eA54JQ6rtdZE7nqaRa6Oa',
			consumerSecret: '6u2makgFdf4F6EauP7osa54L34SouU6eLgaadTD435Rw'
		}
		, 'github': {
			appId: '1444g6a7d26a3f716b47',
			appSecret: 'e84f13367f328da4b8c96a4f74gfe7e421b6a206'
		}
	}
	*/
	, 'db': {'url': 'mongodb://127.0.0.1:27017/myDatabase/myCollection'}
	, 'debug': (process.env.NODE_ENV !== 'production')
};

if (process.env.NODE_ENV == 'production') {
	settings.uri = 'http://yourname.no.de';
	settings.port = process.env.PORT || 80; // Joyent SmartMachine uses process.env.PORT
}
module.exports = settings;
