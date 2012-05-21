// Fetch the site configuration
var siteConf = require('./lib/getConfig');

process.title = siteConf.uri.replace(/http:\/\/(www)?/, '');

process.addListener('uncaughtException', function (err, stack) {
	console.log('Caught exception: '+err+'\n'+err.stack);
	console.log('\u0007'); // Terminal bell
});

var connect = require('connect');
var express = require('express');
var assetManager = require('connect-assetmanager');
var assetHandler = require('connect-assetmanager-handlers');
var DummyHelper = require('./lib/dummy-helper');

// Session store
var MongoStore = require('connect-mongo')(express);
var sessionStore = new MongoStore({url: siteConf.db.url})

var app = module.exports = express.createServer();
app.listen(siteConf.port, null);

// Setup socket.io server
var socketIo = new require('./lib/socket-io-server.js')(app, sessionStore);
var authentication = new require('./lib/authentication.js')(app, siteConf);

// form validation
var form = require("express-form"),
	filter = form.filter,
	validate = form.validate;

// other useful modules
email = require("mailer");

// Setup groups for CSS / JS assets
var assetsSettings = {
	'js': {
		'route': /\/static\/js\/[a-z0-9]+\/.*\.js/
		, 'path': './public/js/'
		, 'dataType': 'javascript'
		, 'files': [
			'http://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.min.js'
			, 'http://ajax.googleapis.com/ajax/libs/jqueryui/1.8.14/jquery-ui.js'
			, 'http://ajax.googleapis.com/ajax/libs/swfobject/2.2/swfobject.js'
			, 'http://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js'
			, siteConf.uri+'/socket.io/socket.io.js' // special case since the socket.io module serves its own js
			, 'jquery.client.js'
			, 'plugins.js'
			, 'script.js'
		]
		, 'debug': true
		, 'postManipulate': {
			'^': [
				assetHandler.uglifyJsOptimize
				, function insertSocketIoPort(file, path, index, isLast, callback) {
					callback(file.replace(/.#socketIoPort#./, siteConf.port));
				}
			]
		}
	}
	, 'css': {
		'route': /\/static\/css\/[a-z0-9]+\/.*\.css/
		, 'path': './public/css/'
		, 'dataType': 'css'
		, 'files': [
			'style.css'
			, 'client.css'
		]
		, 'debug': true
		, 'preManipulate': {
    // Regexp to match user-agents including MSIE.
    'MSIE': [
        assetHandler.yuiCssOptimize
        , assetHandler.fixVendorPrefixes
        , assetHandler.fixGradients
        , assetHandler.stripDataUrlsPrefix
    ]}
    // Matches all (regex start line)
		, 'postManipulate': {
			'^': [
				assetHandler.fixVendorPrefixes
				, assetHandler.fixGradients
				, assetHandler.replaceImageRefToBase64(__dirname+'/public')
				, assetHandler.yuiCssOptimize
			]
		}
	}
};
// Add auto reload for CSS/JS/templates when in development
app.configure('development', function(){
	assetsSettings.js.files.push('jquery.frontend-development.js');
	assetsSettings.css.files.push('frontend-development.css');
	[['js', 'updatedContent'], ['css', 'updatedCss']].forEach(function(group) {
		assetsSettings[group[0]].postManipulate['^'].push(function triggerUpdate(file, path, index, isLast, callback) {
			callback(file);
			dummyHelpers[group[1]]();
		});
	});
});

var assetsMiddleware = assetManager(assetsSettings);
/*
	<%- body %>
	<% if (locals.dummyHelperHtml) {%><%- dummyHelperHtml%><% } %>

*/

// Settings
app.configure(function() {
	app.set('view engine', 'ejs');
	app.set('views', __dirname+'/views');
});

// Middleware
app.configure(function() {
	app.use(express.bodyParser());
	app.use(express.cookieParser());
	app.use(assetsMiddleware);
	
	app.use(express.session({
    secret: siteConf.sessionSecret,
    store: sessionStore
  }));
  
	app.use(express.logger({format: ':response-time ms - :date - :req[x-real-ip] - :method :url :user-agent / :referrer'}));
	app.use(authentication.middleware.auth());
	app.use(authentication.middleware.normalizeUserData());
	app.use(express['static'](__dirname+'/public', {maxAge: 86400000}));
});

// ENV based configuration

// Show all errors and keep search engines out using robots.txt
app.configure('development', function(){
	app.use(express.errorHandler({
		'dumpExceptions': true
		, 'showStack': true
	}));
	app.all('/robots.txt', function(req,res) {
		res.send('User-agent: *\nDisallow: /', {'Content-Type': 'text/plain'});
	});
});
// Suppress errors, allow all search engines
app.configure('production', function(){
	app.use(express.errorHandler());
	app.all('/robots.txt', function(req,res) {
		res.send('User-agent: *', {'Content-Type': 'text/plain'});
	});
});

// Template helpers
app.dynamicHelpers({
	'assetsCacheHashes': function(req, res) {
		return assetsMiddleware.cacheHashes;
	}
	, 'session': function(req, res) {
		return req.session;
	}
});

// Error handling
app.error(function(err, req, res, next){
	console.log(err);

	if (err instanceof NotFound) {
		res.render('errors/404');
	} else {
		res.render('errors/500');
	}
});
function NotFound(msg){
	this.name = 'NotFound';
	Error.call(this, msg);
	Error.captureStackTrace(this, arguments.callee);
}

// Routing
app.all('/', function(req, res) {
	// Set example session uid for use with socket.io.
	if (!req.session.uid) {
		req.session.uid = (0 | Math.random()*1000000);
	}
	res.locals({
		title : 'Page Title'
   	,description: 'Page Description'
	});
	
	res.render('index');
});

// Initiate this after all other routing is done, otherwise wildcard will go crazy.
var dummyHelpers = new DummyHelper(app);

// If all fails, hit em with the 404
app.all('*', function(req, res){
	throw new NotFound;
});

console.log('Running in '+(process.env.NODE_ENV || 'development')+' mode @ '+siteConf.uri);
